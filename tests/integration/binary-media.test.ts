// @vitest-environment node
/**
 * Operações com arquivos binários: binários do FFmpeg ativos, ingestão real de
 * todos os formatos aceitos, rejeição de arquivos corrompidos ou falsificados,
 * limite de tamanho em streaming e renderização a partir de cada tipo de mídia.
 * Ignorado se o FFmpeg não estiver instalado.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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

const dataDir = mkdtempSync(path.join(tmpdir(), "cinemorph-bin-"));
const filesDir = path.join(dataDir, "arquivos");
process.env.CINEMORPH_DATA_DIR = path.join(dataDir, "data");
process.env.CINEMORPH_BACKEND = "local";

const ff = (...args: string[]) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
const owner = "local-user";

type Mods = Awaited<ReturnType<typeof load>>;
async function load() {
  const { LocalDataStore } = await import("@/lib/server/store/local");
  const { LocalBlobStorage } = await import("@/lib/server/storage/local");
  const ingest = await import("@/lib/server/media/ingest");
  const { ffmpegStatus } = await import("@/lib/server/media/ffmpeg");
  const { MediaValidationError } = await import("@/lib/server/media/validate");
  const { runOnce } = await import("@/lib/server/jobs/runner");
  const { jobHandlers } = await import("@/lib/server/jobs/handlers");
  const { serverConfig } = await import("@/lib/server/config");
  const { emptyTimeline } = await import("@/lib/domain/timeline");
  const config = serverConfig();
  return {
    store: new LocalDataStore(config.dbPath),
    storage: new LocalBlobStorage(config.storageDir),
    config,
    ingest,
    ffmpegStatus,
    MediaValidationError,
    runOnce,
    jobHandlers,
    emptyTimeline,
  };
}

describe.skipIf(!hasFfmpeg)("operações com arquivos binários", () => {
  let m: Mods;
  const file = (name: string) => path.join(filesDir, name);

  beforeAll(async () => {
    execFileSync("mkdir", ["-p", filesDir]);
    m = await load();
    await m.store.createProject(owner, { id: "prj_" + "b".repeat(32), name: "Binários", aspectRatio: "16:9", timeline: m.emptyTimeline() });

    // Gera um arquivo real de cada formato aceito
    const video = ["-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=2", "-f", "lavfi", "-i", "sine=frequency=440:duration=2"];
    ff(...video, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file("video.mp4"));
    ff(...video, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file("video.mov"));
    ff(...video, "-c:v", "libvpx", "-b:v", "300k", "-c:a", "libvorbis", "-shortest", file("video.webm"));
    ff(...video, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file("video.mkv"));
    ff("-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", file("mudo.mp4"));
    ff("-f", "lavfi", "-i", "testsrc2=size=800x600", "-frames:v", "1", file("imagem.png"));
    ff("-f", "lavfi", "-i", "testsrc2=size=800x600", "-frames:v", "1", file("imagem.jpg"));
    ff("-f", "lavfi", "-i", "testsrc2=size=800x600", "-frames:v", "1", "-c:v", "libwebp", file("imagem.webp"));
    ff("-f", "lavfi", "-i", "sine=frequency=330:duration=3", file("audio.mp3"));
    ff("-f", "lavfi", "-i", "sine=frequency=330:duration=3", file("audio.wav"));
    ff("-f", "lavfi", "-i", "sine=frequency=330:duration=3", "-c:a", "aac", file("audio.m4a"));

    // Arquivos inválidos
    writeFileSync(file("vazio.mp4"), Buffer.alloc(0));
    writeFileSync(file("texto.mp4"), "isto não é um vídeo, apenas texto com extensão .mp4");
    writeFileSync(file("script.png"), "<?php system($_GET['c']); ?>");
    const mp4 = readFileSync(file("video.mp4"));
    writeFileSync(file("truncado.mp4"), mp4.subarray(0, 600)); // cabeçalho válido, conteúdo cortado
    writeFileSync(file("truncado-700.mp4"), mp4.subarray(0, 700));
    const garbage = Buffer.alloc(4096, 0x41);
    mp4.subarray(0, 32).copy(garbage); // assinatura MP4 + lixo
    writeFileSync(file("assinatura-falsa.mp4"), garbage);
    const png = readFileSync(file("imagem.png"));
    writeFileSync(file("png-corrompido.png"), Buffer.concat([png.subarray(0, 64), Buffer.alloc(2048, 0)]));
  }, 120_000);

  afterAll(() => {
    m?.store.close();
    rmSync(dataDir, { recursive: true, force: true });
  });

  const ingestFile = (name: string, overrides: Partial<{ role: "source" | "reference" }> = {}) =>
    m.ingest.ingestMediaFile(
      { store: m.store, storage: m.storage },
      {
        ownerId: owner,
        projectId: "prj_" + "b".repeat(32),
        role: overrides.role ?? "source",
        filePath: file(name),
        originalName: name,
        origin: "teste",
        rightsConfirmed: true,
      },
    );

  it("binários FFmpeg e FFprobe ativos, com os codecs e filtros usados", async () => {
    const status = await m.ffmpegStatus();
    expect(status.available).toBe(true);
    expect(status.probeAvailable).toBe(true);
    expect(status.encoders).toEqual({ libx264: true, aac: true });
    expect(status.filters.scene).toBe(true);
  });

  it.each([
    ["video.mp4", "video", "video/mp4", true],
    ["video.mov", "video", "video/quicktime", true],
    ["video.webm", "video", "video/webm", true],
    ["video.mkv", "video", "video/x-matroska", true],
    ["mudo.mp4", "video", "video/mp4", false],
    ["imagem.png", "image", "image/png", false],
    ["imagem.jpg", "image", "image/jpeg", false],
    ["imagem.webp", "image", "image/webp", false],
    ["audio.mp3", "audio", "audio/mpeg", true],
    ["audio.wav", "audio", "audio/wav", true],
    ["audio.m4a", "audio", "audio/mp4", true],
  ] as const)("aceita %s como %s (%s)", async (name, kind, mime, hasAudio) => {
    const asset = await ingestFile(name);
    expect(asset.kind).toBe(kind);
    expect(asset.mimeType).toBe(mime);
    expect(asset.hasAudio).toBe(hasAudio);
    expect(asset.sizeBytes).toBe(statSync(file(name)).size);

    // Arquivo armazenado é idêntico byte a byte ao enviado (sha256)
    const stored = await m.storage.materialize(asset.storageKey);
    expect(createHash("sha256").update(readFileSync(stored.path)).digest("hex")).toBe(asset.sha256);
    expect(asset.sha256).toBe(createHash("sha256").update(readFileSync(file(name))).digest("hex"));

    if (kind === "video") {
      expect(asset.width).toBe(640);
      expect(asset.height).toBe(360);
      expect(asset.durationMs).toBeGreaterThan(1500);
    }
    if (kind === "image") expect([asset.width, asset.height]).toEqual([800, 600]);
    if (kind === "audio") {
      expect(asset.durationMs).toBeGreaterThan(2500);
      expect(asset.thumbnailKey).toBeNull();
    } else {
      // Miniatura JPEG válida gerada a partir do binário
      expect(asset.thumbnailKey).not.toBeNull();
      const thumb = readFileSync((await m.storage.materialize(asset.thumbnailKey!)).path);
      expect([...thumb.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    }
  });

  it.each([
    ["vazio.mp4", /vazio/],
    ["texto.mp4", /Formato não reconhecido/],
    ["script.png", /Formato não reconhecido/],
    ["truncado.mp4", /não pôde ser lido|faixa de vídeo|duração/],
    ["truncado-700.mp4", /não pôde ser lido|faixa de vídeo|duração/],
    ["assinatura-falsa.mp4", /não pôde ser lido|faixa de vídeo|duração/],
    ["png-corrompido.png", /não pôde ser lido|decodificada/],
  ])("rejeita %s sem registrar nem guardar nada", async (name, message) => {
    const before = (await m.store.listAssets(owner)).length;
    const error = await ingestFile(name).catch((e: unknown) => e);
    // Precisa ser erro de validação (vira 422 com dica na API), nunca erro genérico (500)
    expect(error).toBeInstanceOf(m.MediaValidationError);
    expect((error as Error).message).toMatch(message);
    expect((await m.store.listAssets(owner)).length).toBe(before);
  });

  it("interrompe o upload em streaming ao passar do limite, sem carregar tudo na memória", async () => {
    const chunk = new Uint8Array(64 * 1024);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += chunk.length;
        if (sent > 10 * 1024 * 1024) controller.close();
        else controller.enqueue(chunk);
      },
    });
    const target = file("grande.bin");
    const error = await m.ingest.streamToTempFile(body, target, 1024 * 1024).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(m.MediaValidationError);
    expect((error as Error).message).toMatch(/limite de 1 MB/);
    expect(sent).toBeLessThan(3 * 1024 * 1024); // parou cedo, não leu os 10 MB
  });

  it("renderiza uma timeline com vídeo sem áudio, imagem e trilha MP3 em 1:1", async () => {
    const assets = await m.store.listAssets(owner);
    const byName = (n: string) => assets.find((a) => a.originalName === n)!;
    const color = { brightness: 0, contrast: 1, saturation: 1 };
    const timeline = {
      ...m.emptyTimeline("1:1"),
      clips: [
        { id: "a", assetId: byName("mudo.mp4").id, kind: "video" as const, in: 0, out: 1.5, volume: 1, muted: false, color },
        { id: "b", assetId: byName("imagem.webp").id, kind: "image" as const, in: 0, out: 1, volume: 1, muted: false, color },
        { id: "c", assetId: byName("video.webm").id, kind: "video" as const, in: 0.5, out: 1.5, volume: 0.8, muted: false, color },
      ],
      music: { assetId: byName("audio.mp3").id, volume: 0.5 },
      output: { aspectRatio: "1:1" as const, quality: "draft" as const, burnSubtitles: false },
    };
    const { job } = await m.store.createJob(owner, {
      id: "job_" + "c".repeat(32),
      projectId: "prj_" + "b".repeat(32),
      type: "render",
      providerId: null,
      input: { projectId: "prj_" + "b".repeat(32), timeline, projectName: "Binários" },
      idempotencyKey: "render-bin",
      maxAttempts: 1,
      costEstimateCents: 0,
    });
    await m.runOnce({ store: m.store, storage: m.storage, handlers: m.jobHandlers, workerId: "t" });
    const done = await m.store.getJob(owner, job.id);
    expect(done?.status, done?.error ?? "").toBe("succeeded");
    const output = await m.store.getAsset(owner, String(done!.output!.assetId));
    expect([output?.width, output?.height]).toEqual([720, 720]);
    expect(output?.hasAudio).toBe(true);
    expect((output!.durationMs ?? 0) / 1000).toBeCloseTo(3.5, 0);

    // O arquivo final é um MP4 H.264 + AAC reproduzível
    const probe = JSON.parse(
      execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", (await m.storage.materialize(output!.storageKey)).path]).toString(),
    ) as { streams: Array<{ codec_name: string }> };
    expect(probe.streams.map((s) => s.codec_name).sort()).toEqual(["aac", "h264"]);
  }, 120_000);
});
