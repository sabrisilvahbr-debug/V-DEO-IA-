import { parseSceneTimes, scenesToSegments } from "@/lib/media/scenes";
import { requireFfmpeg, runFfmpeg } from "@/lib/server/media/ffmpeg";
import { NonRetryableError } from "../errors";
import type { JobHandler } from "../runner";

/** Detecta mudanças de cena e sugere segmentos para revisão manual. */
export const sceneDetectHandler: JobHandler = async (ctx) => {
  const { job, store, storage } = ctx;
  await requireFfmpeg();
  const input = job.input as { assetId: string; threshold: number };
  const asset = await store.getAsset(job.ownerId, input.assetId);
  if (!asset || asset.kind !== "video") throw new NonRetryableError("Vídeo não encontrado.");

  const threshold = Math.min(0.9, Math.max(0.1, Number(input.threshold) || 0.35));
  const file = await storage.materialize(asset.storageKey);
  try {
    await ctx.heartbeat();
    const result = await runFfmpeg(
      ["-i", file.path, "-an", "-vf", `scale=320:-2,select='gt(scene,${threshold})',showinfo`, "-f", "null", "-"],
      { timeoutMs: 15 * 60_000, signal: ctx.signal },
    );
    const durationSeconds = (asset.durationMs ?? 0) / 1000;
    const cuts = parseSceneTimes(result.stderr);
    return { assetId: asset.id, threshold, cuts, segments: scenesToSegments(cuts, durationSeconds) };
  } finally {
    await file.cleanup();
  }
};
