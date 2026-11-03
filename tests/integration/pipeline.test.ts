// @vitest-environment node
/**
 * Teste de integração do pipeline real: SQLite + armazenamento local +
 * FFmpeg + fila + adaptador MOCK + renderização. É ignorado se o FFmpeg não
 * estiver instalado.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const dataDir = mkdtempSync(path.join(tmpdir(), "cinemorph-it-"));
process.env.CINEMORPH_DATA_DIR = dataDir;
process.env.CINEMORPH_BACKEND = "local";

describe.skipIf(!hasFfmpeg)("pipeline local com FFmpeg", () => {
  let mods: Awaited<ReturnType<typeof load>>;
  const owner = "local-user";

  async function load() {
    const { LocalDataStore } = await import("@/lib/server/store/local");
    const { LocalBlobStorage } = await import("@/lib/server/storage/local");
    const { ingestMediaFile } = await import("@/lib/server/media/ingest");
    const { runOnce } = await import("@/lib/server/jobs/runner");
    const { jobHandlers } = await import("@/lib/server/jobs/handlers");
    const { serverConfig } = await import("@/lib/server/config");
    const { emptyTimeline } = await import("@/lib/domain/timeline");
    const config = serverConfig();
    const store = new LocalDataStore(config.dbPath);
    const storage = new LocalBlobStorage(config.storageDir);
    return { store, storage, ingestMediaFile, runOnce, jobHandlers, emptyTimeline };
  }

  beforeAll(async () => {
    mods = await load();
  });

  afterAll(() => {
    mods?.store.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("envia, gera (MOCK), detecta cenas e renderiza um vídeo reproduzível", async () => {
    const { store, storage, ingestMediaFile, runOnce, jobHandlers, emptyTimeline } = mods;
    const deps = { store, storage, handlers: jobHandlers, workerId: "test-worker" };
    const project = await store.createProject(owner, {
      id: "prj_" + "a".repeat(32),
      name: "Teste",
      aspectRatio: "16:9",
      timeline: emptyTimeline("16:9"),
    });

    // 1. Upload: vídeo de 3 s com corte de cena em 1,5 s e áudio
    const source = path.join(dataDir, "fonte.mp4");
    execFileSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "color=c=red:s=320x240:d=1.5:r=25",
      "-f", "lavfi", "-i", "color=c=blue:s=320x240:d=1.5:r=25",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
      "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]",
      "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", source,
    ]);
    const uploaded = await ingestMediaFile(
      { store, storage },
      { ownerId: owner, projectId: project.id, role: "source", filePath: source, originalName: "fonte.mp4", origin: null, rightsConfirmed: true },
    );
    expect(uploaded.kind).toBe("video");
    expect(uploaded.hasAudio).toBe(true);
    expect(uploaded.width).toBe(320);
    expect(uploaded.thumbnailKey).not.toBeNull();

    // 2. Geração MOCK texto→vídeo pela fila
    const { job: gen } = await store.createJob(owner, {
      id: "job_" + "1".repeat(32),
      projectId: project.id,
      type: "generation",
      providerId: "mock",
      input: { mode: "text_to_video", prompt: "teste", aspectRatio: "16:9", durationSeconds: 2, sourceAssetId: null, referenceAssetIds: [] },
      idempotencyKey: "gen-1",
      maxAttempts: 3,
      costEstimateCents: 0,
    });
    expect(await runOnce(deps)).toBe(true);
    const genDone = await store.getJob(owner, gen.id);
    expect(genDone?.status, genDone?.error ?? "").toBe("succeeded");
    const generated = await store.getAsset(owner, String(genDone!.output!.assetId));
    expect(generated?.isDemo).toBe(true);
    expect(generated?.role).toBe("generated");

    // 3. Detecção de cenas
    const { job: scene } = await store.createJob(owner, {
      id: "job_" + "2".repeat(32),
      projectId: project.id,
      type: "scene_detect",
      providerId: null,
      input: { assetId: uploaded.id, threshold: 0.3 },
      idempotencyKey: "scene-1",
      maxAttempts: 1,
      costEstimateCents: 0,
    });
    await runOnce(deps);
    const sceneDone = await store.getJob(owner, scene.id);
    expect(sceneDone?.status, sceneDone?.error ?? "").toBe("succeeded");
    const cuts = sceneDone!.output!.cuts as number[];
    expect(cuts.length).toBe(1);
    expect(cuts[0]).toBeCloseTo(1.5, 1);

    // 4. Renderização 9:16 com dois clipes, cor e legenda
    const timeline = {
      ...emptyTimeline("9:16"),
      clips: [
        { id: "c1", assetId: uploaded.id, kind: "video" as const, in: 0.5, out: 2, volume: 1, muted: false, color: { brightness: 0.05, contrast: 1.1, saturation: 1.2 } },
        { id: "c2", assetId: generated!.id, kind: "video" as const, in: 0, out: 1, volume: 1, muted: false, color: { brightness: 0, contrast: 1, saturation: 1 } },
      ],
      subtitles: [{ id: "s1", start: 0, end: 1, text: "Olá" }],
      output: { aspectRatio: "9:16" as const, quality: "draft" as const, burnSubtitles: true },
    };
    const { job: render } = await store.createJob(owner, {
      id: "job_" + "3".repeat(32),
      projectId: project.id,
      type: "render",
      providerId: null,
      input: { projectId: project.id, timeline, projectName: "Teste" },
      idempotencyKey: "render-1",
      maxAttempts: 1,
      costEstimateCents: 0,
    });
    await runOnce(deps);
    const renderDone = await store.getJob(owner, render.id);
    expect(renderDone?.status, renderDone?.error ?? "").toBe("succeeded");
    const output = await store.getAsset(owner, String(renderDone!.output!.assetId));
    expect(output?.role).toBe("render");
    expect(output?.width).toBe(720);
    expect(output?.height).toBe(1280);
    expect(output?.hasAudio).toBe(true);
    expect((output!.durationMs ?? 0) / 1000).toBeCloseTo(2.5, 0);
    const versions = await store.listVersions(owner, project.id);
    expect(versions).toHaveLength(1);
    expect(versions[0].number).toBe(1);
  }, 120_000);
});
