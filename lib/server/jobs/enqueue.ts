import "server-only";
import { randomUUID } from "node:crypto";
import type { GenerationRequest, QuoteRequest } from "@/lib/api/schemas";
import { timelineDuration } from "@/lib/domain/timeline";
import type { Job } from "@/lib/domain/types";
import { providerCandidates } from "@/providers/registry";
import { routeGeneration, type RoutingResult } from "@/providers/router";
import type { GenerationInput } from "@/providers/types";
import { serverConfig } from "../config";
import type { RequestContext } from "../context";
import { authorizeCost, startOfMonthIso } from "../costs";
import { HttpError } from "../http";
import { checkRateLimit } from "../rate-limit";
import { requireProject, validateTimelineAssets } from "../services/projects";

export const newJobId = () => `job_${randomUUID().replace(/-/g, "")}`;

async function resolveGenerationAssets(ctx: RequestContext, request: QuoteRequest) {
  let sourceVideoSeconds: number | undefined;
  if (request.mode === "video_to_video") {
    if (!request.sourceAssetId) throw new HttpError(400, "Selecione o vídeo de origem.", "origem_ausente");
    const source = await ctx.store.getAsset(ctx.user.id, request.sourceAssetId);
    if (!source || source.kind !== "video") throw new HttpError(400, "O vídeo de origem é inválido.", "origem_invalida");
    if (!source.rightsConfirmed) {
      throw new HttpError(400, "Confirme os direitos sobre o vídeo de origem antes de transformá-lo.", "sem_consentimento");
    }
    sourceVideoSeconds = (source.durationMs ?? 0) / 1000;
  }
  if (request.referenceAssetIds.length) {
    const refs = await ctx.store.getAssetsByIds(ctx.user.id, request.referenceAssetIds);
    if (refs.length !== request.referenceAssetIds.length || refs.some((r) => r.kind !== "image")) {
      throw new HttpError(400, "Uma das referências é inválida.", "referencia_invalida");
    }
  }
  return { sourceVideoSeconds };
}

/** Escolhe o provedor e estima o custo, sem criar nada. */
export async function quoteGeneration(ctx: RequestContext, request: QuoteRequest) {
  await requireProject(ctx, request.projectId);
  const { sourceVideoSeconds } = await resolveGenerationAssets(ctx, request);
  const input: GenerationInput = {
    mode: request.mode,
    prompt: request.prompt,
    aspectRatio: request.aspectRatio,
    durationSeconds: request.durationSeconds,
    sourceVideoSeconds,
    referenceImagePaths: [],
  };
  const candidates = await providerCandidates(input);
  const routing: RoutingResult = routeGeneration(candidates, {
    mode: request.mode,
    aspectRatio: request.aspectRatio,
    durationSeconds: request.durationSeconds,
    hasReferenceImages: request.referenceAssetIds.length > 0,
    sourceVideoSeconds,
    providerId: request.providerId,
  });
  return { routing, candidates };
}

export async function createGenerationJob(ctx: RequestContext, request: GenerationRequest): Promise<{ job: Job; created: boolean }> {
  checkRateLimit(`${ctx.user.id}:generation`, 10, 60_000);
  const { routing } = await quoteGeneration(ctx, request);
  if (!routing.ok) throw new HttpError(422, routing.reason, "sem_provedor", { rejected: routing.rejected });

  const { provider } = routing;
  const spent = (await ctx.store.listUsage(ctx.user.id, { since: startOfMonthIso() })).reduce((t, e) => t + e.costCents, 0);
  const authorization = authorizeCost({
    estimate: provider.cost,
    providerPaid: provider.info.paid,
    confirmedCostCents: request.confirmedCostCents,
    acceptUnknownCost: request.acceptUnknownCost,
    budgetCents: serverConfig().operationalBudgetCents,
    spentThisMonthCents: spent,
  });
  if (!authorization.ok) {
    throw new HttpError(402, authorization.message, authorization.code, { estimate: provider.cost });
  }

  return ctx.store.createJob(ctx.user.id, {
    id: newJobId(),
    projectId: request.projectId,
    type: "generation",
    providerId: provider.info.id,
    input: {
      mode: request.mode,
      prompt: request.prompt,
      scene: request.scene ?? null,
      aspectRatio: request.aspectRatio,
      durationSeconds: request.durationSeconds,
      sourceAssetId: request.sourceAssetId ?? null,
      referenceAssetIds: request.referenceAssetIds,
      isDemo: provider.info.isDemo,
    },
    idempotencyKey: `generation:${request.clientRequestId}`,
    // Provedores pagos não são repetidos automaticamente para evitar cobrança dupla.
    maxAttempts: provider.info.paid ? 1 : 3,
    costEstimateCents: provider.cost.known ? provider.cost.cents : null,
  });
}

export async function createRenderJob(ctx: RequestContext, input: { projectId: string; clientRequestId: string }) {
  checkRateLimit(`${ctx.user.id}:render`, 10, 60_000);
  const project = await requireProject(ctx, input.projectId);
  if (project.timeline.clips.length === 0) {
    throw new HttpError(422, "Adicione pelo menos um clipe à timeline antes de exportar.", "timeline_vazia");
  }
  await validateTimelineAssets(ctx, project.timeline);
  const durationSeconds = timelineDuration(project.timeline);
  if (durationSeconds > serverConfig().maxVideoSeconds) {
    throw new HttpError(422, `A timeline tem ${Math.round(durationSeconds)} s; o máximo é ${serverConfig().maxVideoSeconds} s.`, "timeline_longa");
  }
  return ctx.store.createJob(ctx.user.id, {
    id: newJobId(),
    projectId: project.id,
    type: "render",
    providerId: null,
    input: { projectId: project.id, timeline: project.timeline, projectName: project.name },
    idempotencyKey: `render:${input.clientRequestId}`,
    maxAttempts: 2,
    costEstimateCents: 0,
  });
}

export async function createSceneDetectJob(
  ctx: RequestContext,
  input: { projectId: string; assetId: string; threshold: number; clientRequestId: string },
) {
  checkRateLimit(`${ctx.user.id}:scene`, 20, 60_000);
  await requireProject(ctx, input.projectId);
  const asset = await ctx.store.getAsset(ctx.user.id, input.assetId);
  if (!asset || asset.kind !== "video") throw new HttpError(400, "Selecione um vídeo para detectar cenas.", "midia_invalida");
  return ctx.store.createJob(ctx.user.id, {
    id: newJobId(),
    projectId: input.projectId,
    type: "scene_detect",
    providerId: null,
    input: { assetId: asset.id, threshold: input.threshold },
    idempotencyKey: `scene:${input.clientRequestId}`,
    maxAttempts: 2,
    costEstimateCents: 0,
  });
}
