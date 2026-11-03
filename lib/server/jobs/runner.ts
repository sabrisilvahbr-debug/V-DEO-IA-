import type { Job, JobType } from "@/lib/domain/types";
import type { BlobStorage } from "../storage/types";
import type { DataStore } from "../store/types";
import { JobCanceledError, NonRetryableError, retryDelayMs } from "./errors";

export type JobContext = {
  job: Job;
  store: DataStore;
  storage: BlobStorage;
  workerId: string;
  /** Renova o lease e verifica cancelamento; chame em etapas longas. */
  heartbeat: () => Promise<void>;
  setProgress: (progress: number) => Promise<void>;
  signal: AbortSignal;
};

export type JobHandler = (ctx: JobContext) => Promise<Record<string, unknown>>;
export type JobHandlers = Record<JobType, JobHandler>;

export const LEASE_MS = 120_000;

/**
 * Executa um job reservado: chama o handler, renova o lease, trata
 * cancelamento e decide entre nova tentativa (com atraso) ou falha definitiva.
 */
export async function processJob(
  deps: { store: DataStore; storage: BlobStorage; handlers: JobHandlers; workerId: string },
  job: Job,
): Promise<Job | null> {
  const { store } = deps;
  const controller = new AbortController();

  const heartbeat = async () => {
    const current = await store.getJobById(job.id);
    if (!current || current.cancelRequested) {
      controller.abort();
      throw new JobCanceledError();
    }
    await store.extendLease(job.id, deps.workerId, LEASE_MS);
  };

  try {
    if (job.cancelRequested) throw new JobCanceledError();
    const output = await deps.handlers[job.type]({
      job,
      store,
      storage: deps.storage,
      workerId: deps.workerId,
      heartbeat,
      setProgress: async (progress) => {
        await store.updateJob(job.id, { progress: Math.max(0, Math.min(1, progress)) });
      },
      signal: controller.signal,
    });
    return store.updateJob(job.id, {
      status: "succeeded",
      output,
      error: null,
      progress: 1,
      lockedBy: null,
      lockedUntil: null,
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof JobCanceledError || controller.signal.aborted) {
      return store.updateJob(job.id, {
        status: "canceled",
        error: "Cancelada pelo usuário.",
        lockedBy: null,
        lockedUntil: null,
        finishedAt: new Date().toISOString(),
      });
    }
    const retryable = !(error instanceof NonRetryableError) && job.attempts < job.maxAttempts;
    console.error(`[worker] job ${job.id} (${job.type}) tentativa ${job.attempts}/${job.maxAttempts} falhou: ${message}`);
    if (retryable) {
      return store.updateJob(job.id, {
        status: "queued",
        error: message,
        runAfter: new Date(Date.now() + retryDelayMs(job.attempts)).toISOString(),
        lockedBy: null,
        lockedUntil: null,
      });
    }
    return store.updateJob(job.id, {
      status: "failed",
      error: message,
      lockedBy: null,
      lockedUntil: null,
      finishedAt: new Date().toISOString(),
    });
  }
}

/** Reserva e executa um job da fila. Retorna `false` quando a fila está vazia. */
export async function runOnce(deps: {
  store: DataStore;
  storage: BlobStorage;
  handlers: JobHandlers;
  workerId: string;
}): Promise<boolean> {
  const job = await deps.store.claimNextJob(deps.workerId, LEASE_MS);
  if (!job) return false;
  await processJob(deps, job);
  return true;
}
