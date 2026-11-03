import path from "node:path";
import { serverConfig } from "@/lib/server/config";
import { MockVideoProvider } from "./mock";
import type { GenerationInput, VideoProvider } from "./types";
import type { ProviderCandidate } from "./router";

/**
 * Registro dos provedores efetivamente implementados.
 *
 * Integrações reais (Google, Runway, Hugging Face) entram aqui apenas depois
 * de verificadas na documentação oficial — ver docs/providers.md.
 */
let providers: VideoProvider[] | null = null;

export function listProviders(): VideoProvider[] {
  if (!providers) {
    const config = serverConfig();
    providers = [new MockVideoProvider(path.join(config.tmpDir, "mock-provider"), config.mockProviderEnabled)];
  }
  return providers;
}

export function getProvider(id: string): VideoProvider | null {
  return listProviders().find((p) => p.id === id) ?? null;
}

/** Monta os candidatos para o roteador com capacidade, disponibilidade e custo. */
export async function providerCandidates(input: GenerationInput): Promise<ProviderCandidate[]> {
  return Promise.all(
    listProviders().map(async (provider) => {
      const [availability, capabilities, cost] = await Promise.all([
        provider.availability(),
        provider.getCapabilities(),
        provider.estimateCost(input).catch(() => ({ known: false, cents: null, currency: "USD" as const, basis: "Falha ao estimar." })),
      ]);
      return {
        info: provider.info(),
        available: availability.available,
        unavailableReason: availability.available ? undefined : availability.reason,
        capabilities,
        cost,
      };
    }),
  );
}

/** Provedores planejados, exibidos apenas como informação (não executáveis). */
export const plannedProviders = [
  { name: "Google Gemini API (vídeo)", stage: 6 },
  { name: "Runway API", stage: 6 },
  { name: "Hugging Face Inference Providers", stage: 6 },
];
