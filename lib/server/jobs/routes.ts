import "server-only";
import { z } from "zod";
import type { JobType } from "@/lib/domain/types";
import type { RequestContext } from "../context";
import { HttpError } from "../http";
import { toPublicJob } from "./public";

const jobIdSchema = z.string().regex(/^job_[a-f0-9]{32}$/, "Identificador inválido.");

/** Busca um job do usuário, opcionalmente exigindo o tipo. */
export async function getJobResponse(ctx: RequestContext, id: string, type?: JobType) {
  const job = await ctx.store.getJob(ctx.user.id, jobIdSchema.parse(id));
  if (!job || (type && job.type !== type)) throw new HttpError(404, "Tarefa não encontrada.", "nao_encontrado");
  return Response.json({ job: toPublicJob(job) });
}

export async function cancelJobResponse(ctx: RequestContext, id: string, type?: JobType) {
  const jobId = jobIdSchema.parse(id);
  const existing = await ctx.store.getJob(ctx.user.id, jobId);
  if (!existing || (type && existing.type !== type)) throw new HttpError(404, "Tarefa não encontrada.", "nao_encontrado");
  if (!["queued", "running"].includes(existing.status)) {
    throw new HttpError(409, "A tarefa já foi concluída.", "tarefa_finalizada");
  }
  const job = await ctx.store.requestJobCancel(ctx.user.id, jobId);
  return Response.json({ job: job ? toPublicJob(job) : null });
}
