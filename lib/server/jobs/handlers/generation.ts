import { ingestMediaFile } from "@/lib/server/media/ingest";
import { getProvider } from "@/providers/registry";
import type { GenerationInput, GenerationMode } from "@/providers/types";
import { NonRetryableError } from "../errors";
import type { JobHandler } from "../runner";

const POLL_INTERVAL_MS = 3_000;
const MAX_WAIT_MS = 30 * 60_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Geração de vídeo por um provedor.
 *
 * Se a tarefa já tem `providerJobId` (tentativa anterior interrompida), apenas
 * acompanha o job existente no provedor — nunca inicia outro, para não cobrar
 * duas vezes.
 */
export const generationHandler: JobHandler = async (ctx) => {
  const { job, store, storage } = ctx;
  const provider = job.providerId ? getProvider(job.providerId) : null;
  if (!provider) throw new NonRetryableError(`Provedor "${job.providerId}" não está disponível.`);
  const info = provider.info();
  const input = job.input as {
    mode: GenerationMode;
    prompt: string;
    aspectRatio: GenerationInput["aspectRatio"];
    durationSeconds: number;
    sourceAssetId: string | null;
    referenceAssetIds: string[];
  };

  let providerJobId = job.providerJobId;
  const cleanups: Array<() => Promise<void>> = [];

  try {
    if (!providerJobId) {
      const availability = await provider.availability();
      if (!availability.available) throw new Error(`Provedor indisponível: ${availability.reason}`);

      const generationInput: GenerationInput = {
        mode: input.mode,
        prompt: input.prompt,
        aspectRatio: input.aspectRatio,
        durationSeconds: input.durationSeconds,
        referenceImagePaths: [],
      };
      if (input.mode === "video_to_video") {
        const source = input.sourceAssetId ? await store.getAsset(job.ownerId, input.sourceAssetId) : null;
        if (!source) throw new NonRetryableError("O vídeo de origem foi excluído.");
        const file = await storage.materialize(source.storageKey);
        cleanups.push(file.cleanup);
        generationInput.sourceVideoPath = file.path;
        generationInput.sourceVideoSeconds = (source.durationMs ?? 0) / 1000;
      }
      for (const refId of input.referenceAssetIds) {
        const ref = await store.getAsset(job.ownerId, refId);
        if (!ref) throw new NonRetryableError("Uma imagem de referência foi excluída.");
        const file = await storage.materialize(ref.storageKey);
        cleanups.push(file.cleanup);
        generationInput.referenceImagePaths.push(file.path);
      }

      await ctx.heartbeat();
      const estimate = await provider.estimateCost(generationInput);
      try {
        ({ providerJobId } = await provider.startJob(generationInput, { idempotencyKey: job.id, signal: ctx.signal }));
      } catch (error) {
        // Em provedor pago, não sabemos se houve cobrança: não repetir automaticamente.
        if (info.paid) throw new NonRetryableError(`Falha ao iniciar no provedor: ${(error as Error).message}`);
        throw error;
      }
      await store.updateJob(job.id, { providerJobId, progress: 0.1 });
      await store.recordUsage(job.ownerId, {
        id: `use_${job.id}`,
        jobId: job.id,
        providerId: info.id,
        kind: `generation:${input.mode}`,
        costCents: estimate.known ? (estimate.cents ?? 0) : (job.costEstimateCents ?? 0),
        idempotencyKey: `generation-start:${job.id}`,
      });
    }

    const startedAt = Date.now();
    for (;;) {
      await ctx.heartbeat();
      const status = await provider.getJobStatus(providerJobId);
      if (status.state === "succeeded") break;
      if (status.state === "failed") throw new NonRetryableError(status.error ?? "O provedor informou falha.");
      if (status.state === "canceled") throw new NonRetryableError("O provedor cancelou a tarefa.");
      if (status.progress !== undefined) await ctx.setProgress(0.1 + status.progress * 0.7);
      if (Date.now() - startedAt > MAX_WAIT_MS) throw new NonRetryableError("O provedor não concluiu dentro do tempo limite.");
      await sleep(POLL_INTERVAL_MS);
    }

    await ctx.setProgress(0.85);
    const result = await provider.getResult(providerJobId);
    try {
      const asset = await ingestMediaFile(
        { store, storage },
        {
          ownerId: job.ownerId,
          projectId: job.projectId,
          role: "generated",
          filePath: result.filePath,
          originalName: `${info.isDemo ? "demo" : info.id}-${input.mode}-${job.id.slice(4, 12)}.mp4`,
          origin: info.isDemo ? "Demonstração MOCK (sem IA)" : `Gerado por ${info.name}`,
          rightsConfirmed: true,
          isDemo: info.isDemo,
        },
      );
      return { assetId: asset.id, providerId: info.id, isDemo: info.isDemo };
    } finally {
      await result.cleanup();
    }
  } catch (error) {
    if (ctx.signal.aborted && providerJobId && provider.cancelJob) {
      await provider.cancelJob(providerJobId).catch(() => {});
    }
    throw error;
  } finally {
    for (const cleanup of cleanups) await cleanup().catch(() => {});
  }
};
