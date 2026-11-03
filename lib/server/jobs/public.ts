import type { Job } from "@/lib/domain/types";

/** Representação do job enviada ao navegador (sem dados internos do worker). */
export function toPublicJob(job: Job) {
  return {
    id: job.id,
    projectId: job.projectId,
    type: job.type,
    status: job.status,
    providerId: job.providerId,
    input: job.input,
    output: job.output,
    error: job.error,
    progress: job.progress,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    cancelRequested: job.cancelRequested,
    costEstimateCents: job.costEstimateCents,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

export type PublicJob = ReturnType<typeof toPublicJob>;
