import type { CostEstimate } from "@/providers/types";

/**
 * Guarda de custos. Não existe sistema de créditos internos: a guarda só
 * impede cobranças externas sem autorização explícita ou acima do orçamento
 * operacional configurado.
 */
export type CostAuthorizationInput = {
  estimate: CostEstimate;
  providerPaid: boolean;
  confirmedCostCents?: number;
  acceptUnknownCost: boolean;
  /** Orçamento operacional mensal em centavos (0 = nenhum gasto pago permitido). */
  budgetCents: number;
  spentThisMonthCents: number;
};

export type CostAuthorization =
  | { ok: true }
  | { ok: false; code: "confirmacao_necessaria" | "custo_desconhecido" | "orcamento_excedido"; message: string };

export function authorizeCost(input: CostAuthorizationInput): CostAuthorization {
  const { estimate } = input;
  if (!input.providerPaid && estimate.known && (estimate.cents ?? 0) === 0) return { ok: true };

  if (!estimate.known || estimate.cents === null) {
    if (!input.acceptUnknownCost) {
      return {
        ok: false,
        code: "custo_desconhecido",
        message: "O custo desta operação não pôde ser calculado. Confirme explicitamente para continuar.",
      };
    }
    if (input.budgetCents <= input.spentThisMonthCents) {
      return { ok: false, code: "orcamento_excedido", message: "O orçamento operacional do mês já foi atingido." };
    }
    return { ok: true };
  }

  if (input.confirmedCostCents !== estimate.cents) {
    return {
      ok: false,
      code: "confirmacao_necessaria",
      message: `Esta operação custa aproximadamente ${formatCents(estimate.cents)}. Confirme o valor para continuar.`,
    };
  }
  if (input.spentThisMonthCents + estimate.cents > input.budgetCents) {
    return {
      ok: false,
      code: "orcamento_excedido",
      message: `A operação ultrapassaria o orçamento operacional (${formatCents(input.budgetCents)}/mês).`,
    };
  }
  return { ok: true };
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function startOfMonthIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
