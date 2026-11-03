import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseTimeline } from "@/lib/domain/timeline";
import { buildRenderPlan, parseProgressLine, type RenderSource } from "@/lib/media/render-plan";
import { buildSrt } from "@/lib/media/srt";
import { ffmpegStatus, requireFfmpeg, runFfmpeg } from "@/lib/server/media/ffmpeg";
import { ingestMediaFile, makeTempDir } from "@/lib/server/media/ingest";
import { NonRetryableError } from "../errors";
import type { JobHandler } from "../runner";

/**
 * Renderiza a timeline (snapshot salvo no job) com FFmpeg, registra o
 * arquivo como mídia "render" e cria uma nova versão do projeto.
 */
export const renderHandler: JobHandler = async (ctx) => {
  const { job, store, storage } = ctx;
  await requireFfmpeg();
  const timeline = parseTimeline((job.input as { timeline?: unknown }).timeline);
  const projectName = String((job.input as { projectName?: unknown }).projectName ?? "projeto");
  if (!job.projectId || timeline.clips.length === 0) throw new NonRetryableError("Timeline vazia.");

  const ids = [...new Set([...timeline.clips.map((c) => c.assetId), ...(timeline.music ? [timeline.music.assetId] : [])])];
  const assets = await store.getAssetsByIds(job.ownerId, ids);
  if (assets.length !== ids.length) throw new NonRetryableError("Uma das mídias da timeline foi excluída.");

  const workDir = await makeTempDir("render");
  const cleanups: Array<() => Promise<void>> = [];
  const warnings: string[] = [];
  try {
    const sources = new Map<string, RenderSource>();
    for (const asset of assets) {
      const file = await storage.materialize(asset.storageKey);
      cleanups.push(file.cleanup);
      sources.set(asset.id, { path: file.path, kind: asset.kind, hasAudio: asset.hasAudio });
    }

    let subtitlesPath: string | null = null;
    if (timeline.subtitles.length && timeline.output.burnSubtitles) {
      if ((await ffmpegStatus()).filters.subtitles) {
        subtitlesPath = path.join(workDir, "legendas.srt");
        await writeFile(subtitlesPath, buildSrt(timeline.subtitles), "utf8");
      } else {
        warnings.push("Seu FFmpeg não tem o filtro de legendas (libass); as legendas não foram gravadas no vídeo.");
      }
    }

    const outputPath = path.join(workDir, "render.mp4");
    const plan = buildRenderPlan({ timeline, sources, outputPath, subtitlesPath });
    await ctx.heartbeat();

    let lastBeat = Date.now();
    let lastProgress = 0;
    await runFfmpeg(plan.args, {
      timeoutMs: Math.max(10 * 60_000, plan.durationSeconds * 20_000),
      signal: ctx.signal,
      onStdoutLine: (line) => {
        const progress = parseProgressLine(line, plan.durationSeconds);
        if (progress !== null && progress - lastProgress >= 0.02) {
          lastProgress = progress;
          void ctx.setProgress(progress * 0.9);
        }
        if (Date.now() - lastBeat > 10_000) {
          lastBeat = Date.now();
          void ctx.heartbeat().catch(() => {});
        }
      },
    });
    if (ctx.signal.aborted) throw new Error("Cancelada.");

    const safeName = projectName.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 60) || "projeto";
    const asset = await ingestMediaFile(
      { store, storage },
      {
        ownerId: job.ownerId,
        projectId: job.projectId,
        role: "render",
        filePath: outputPath,
        originalName: `${safeName} ${timeline.output.aspectRatio.replace(":", "x")}.mp4`,
        origin: "Exportação do CINEMORPH AI",
        rightsConfirmed: true,
        isDemo: assets.some((a) => a.isDemo),
      },
    );
    const version = await store.createVersion(job.ownerId, {
      id: `ver_${randomUUID().replace(/-/g, "")}`,
      projectId: job.projectId,
      renderAssetId: asset.id,
      timeline,
    });
    return {
      assetId: asset.id,
      versionId: version.id,
      versionNumber: version.number,
      durationSeconds: plan.durationSeconds,
      width: plan.width,
      height: plan.height,
      warnings,
    };
  } finally {
    for (const cleanup of cleanups) await cleanup().catch(() => {});
    await rm(workDir, { recursive: true, force: true });
  }
};
