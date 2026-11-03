import type { AspectRatio } from "@/lib/domain/types";
import type { CostEstimate, GenerationMode, ProviderCapabilities, ProviderInfo } from "./types";

/**
 * Roteador de modelos: escolhe o provedor por capacidade, disponibilidade e
 * custo — nunca pelo nome comercial. Não substitui silenciosamente uma
 * modalidade por outra (ex.: vídeo para vídeo por texto para vídeo).
 */
export type RoutingRequest = {
  mode: GenerationMode;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  hasReferenceImages: boolean;
  sourceVideoSeconds?: number;
  /** "auto" ou o id de um provedor específico. */
  providerId: string;
};

export type ProviderCandidate = {
  info: ProviderInfo;
  available: boolean;
  unavailableReason?: string;
  capabilities: ProviderCapabilities;
  cost: CostEstimate;
};

export type RoutingResult =
  | { ok: true; provider: ProviderCandidate; alternatives: ProviderCandidate[] }
  | { ok: false; reason: string; rejected: Array<{ id: string; reason: string }> };

export function incompatibility(candidate: ProviderCandidate, request: RoutingRequest): string | null {
  const caps = candidate.capabilities;
  if (!candidate.available) return candidate.unavailableReason ?? "Indisponível.";
  if (!caps.modes.includes(request.mode)) return "Não suporta esta modalidade.";
  if (!caps.aspectRatios.includes(request.aspectRatio)) return `Não suporta a proporção ${request.aspectRatio}.`;
  if (request.durationSeconds < caps.minDurationSeconds || request.durationSeconds > caps.maxDurationSeconds) {
    return `Duração permitida: ${caps.minDurationSeconds}–${caps.maxDurationSeconds} s.`;
  }
  if (request.hasReferenceImages && !caps.acceptsReferenceImages) return "Não aceita imagens de referência.";
  if (
    request.mode === "video_to_video" &&
    caps.maxInputVideoSeconds !== null &&
    request.sourceVideoSeconds !== undefined &&
    request.sourceVideoSeconds > caps.maxInputVideoSeconds
  ) {
    return `Vídeo de origem acima de ${caps.maxInputVideoSeconds} s.`;
  }
  return null;
}

function costRank(cost: CostEstimate): number {
  // Custo conhecido e menor vem primeiro; desconhecido vai para o fim.
  return cost.known && cost.cents !== null ? cost.cents : Number.MAX_SAFE_INTEGER;
}

export function routeGeneration(candidates: ProviderCandidate[], request: RoutingRequest): RoutingResult {
  const pool =
    request.providerId === "auto" ? candidates : candidates.filter((c) => c.info.id === request.providerId);
  if (pool.length === 0) {
    return { ok: false, reason: "Provedor não encontrado.", rejected: [] };
  }

  const rejected: Array<{ id: string; reason: string }> = [];
  const compatible: ProviderCandidate[] = [];
  for (const candidate of pool) {
    const reason = incompatibility(candidate, request);
    if (reason) rejected.push({ id: candidate.info.id, reason });
    else compatible.push(candidate);
  }

  if (compatible.length === 0) {
    const reason =
      request.providerId === "auto"
        ? "Nenhum provedor conectado atende a esta solicitação."
        : `O provedor selecionado não atende a esta solicitação: ${rejected[0]?.reason ?? ""}`;
    return { ok: false, reason, rejected };
  }

  compatible.sort((a, b) => costRank(a.cost) - costRank(b.cost) || a.info.id.localeCompare(b.info.id));
  const [provider, ...alternatives] = compatible;
  return { ok: true, provider, alternatives };
}
