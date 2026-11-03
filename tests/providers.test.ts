import { describe, expect, it } from "vitest";
import { authorizeCost } from "@/lib/server/costs";
import { routeGeneration, type ProviderCandidate } from "@/providers/router";

const caps = {
  modes: ["text_to_video" as const],
  aspectRatios: ["16:9" as const, "9:16" as const],
  minDurationSeconds: 2,
  maxDurationSeconds: 8,
  acceptsReferenceImages: false,
  preservesMotion: false,
  maxInputVideoSeconds: null,
};

function candidate(id: string, overrides: Partial<ProviderCandidate> = {}): ProviderCandidate {
  return {
    info: { id, name: id, isDemo: false, paid: true, docsUrl: null, verifiedAt: null, notes: "" },
    available: true,
    capabilities: caps,
    cost: { known: true, cents: 100, currency: "USD", basis: "" },
    ...overrides,
  };
}

const request = { mode: "text_to_video" as const, aspectRatio: "16:9" as const, durationSeconds: 5, hasReferenceImages: false, providerId: "auto" };

describe("routeGeneration", () => {
  it("escolhe o compatível de menor custo conhecido", () => {
    const result = routeGeneration(
      [
        candidate("caro", { cost: { known: true, cents: 500, currency: "USD", basis: "" } }),
        candidate("barato", { cost: { known: true, cents: 50, currency: "USD", basis: "" } }),
        candidate("desconhecido", { cost: { known: false, cents: null, currency: "USD", basis: "" } }),
      ],
      request,
    );
    expect(result.ok && result.provider.info.id).toBe("barato");
    expect(result.ok && result.alternatives.map((a) => a.info.id)).toEqual(["caro", "desconhecido"]);
  });

  it("nunca troca vídeo-para-vídeo por texto-para-vídeo", () => {
    const result = routeGeneration([candidate("t2v")], { ...request, mode: "video_to_video" });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.rejected[0].reason).toMatch(/modalidade/);
  });

  it("explica por que um provedor específico não serve", () => {
    const result = routeGeneration([candidate("a"), candidate("b", { available: false, unavailableReason: "Sem chave." })], {
      ...request,
      providerId: "b",
    });
    expect(!result.ok && result.reason).toMatch(/Sem chave/);
  });

  it("filtra por proporção, duração e referências", () => {
    expect(routeGeneration([candidate("a")], { ...request, aspectRatio: "1:1" }).ok).toBe(false);
    expect(routeGeneration([candidate("a")], { ...request, durationSeconds: 12 }).ok).toBe(false);
    expect(routeGeneration([candidate("a")], { ...request, hasReferenceImages: true }).ok).toBe(false);
    expect(routeGeneration([candidate("a")], { ...request, providerId: "zzz" }).ok).toBe(false);
  });
});

describe("authorizeCost", () => {
  const base = { providerPaid: true, acceptUnknownCost: false, budgetCents: 1000, spentThisMonthCents: 0 };

  it("libera provedor gratuito sem confirmação", () => {
    expect(authorizeCost({ ...base, providerPaid: false, estimate: { known: true, cents: 0, currency: "USD", basis: "" } }).ok).toBe(true);
  });

  it("exige o valor exato confirmado", () => {
    const estimate = { known: true, cents: 300, currency: "USD" as const, basis: "" };
    expect(authorizeCost({ ...base, estimate })).toMatchObject({ ok: false, code: "confirmacao_necessaria" });
    expect(authorizeCost({ ...base, estimate, confirmedCostCents: 200 })).toMatchObject({ ok: false });
    expect(authorizeCost({ ...base, estimate, confirmedCostCents: 300 }).ok).toBe(true);
  });

  it("bloqueia acima do orçamento operacional", () => {
    const estimate = { known: true, cents: 300, currency: "USD" as const, basis: "" };
    expect(authorizeCost({ ...base, estimate, confirmedCostCents: 300, spentThisMonthCents: 800 })).toMatchObject({ code: "orcamento_excedido" });
    expect(authorizeCost({ ...base, estimate, confirmedCostCents: 300, budgetCents: 0 })).toMatchObject({ code: "orcamento_excedido" });
  });

  it("custo desconhecido exige aceite explícito e orçamento disponível", () => {
    const estimate = { known: false, cents: null, currency: "USD" as const, basis: "" };
    expect(authorizeCost({ ...base, estimate })).toMatchObject({ code: "custo_desconhecido" });
    expect(authorizeCost({ ...base, estimate, acceptUnknownCost: true }).ok).toBe(true);
    expect(authorizeCost({ ...base, estimate, acceptUnknownCost: true, budgetCents: 0 })).toMatchObject({ code: "orcamento_excedido" });
  });
});
