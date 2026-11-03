/**
 * Limitador de requisições em memória (janela deslizante simples), por
 * usuário e ação. Protege contra abuso automatizado em uma única instância;
 * em produção com várias instâncias, substituir por um armazenamento compartilhado.
 */
export class RateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Muitas requisições. Aguarde um pouco e tente novamente.");
  }
}

const buckets = new Map<string, number[]>();

export function checkRateLimit(key: string, limit: number, windowMs: number, nowMs = Date.now()): void {
  const recent = (buckets.get(key) ?? []).filter((t) => nowMs - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    throw new RateLimitError(Math.max(1, Math.ceil((windowMs - (nowMs - recent[0])) / 1000)));
  }
  recent.push(nowMs);
  buckets.set(key, recent);
}

export function resetRateLimits(): void {
  buckets.clear();
}
