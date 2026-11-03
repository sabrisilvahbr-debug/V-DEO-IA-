/** Falha que não deve ser repetida (entrada inválida, possível cobrança duplicada etc.). */
export class NonRetryableError extends Error {}

/** O usuário pediu o cancelamento. */
export class JobCanceledError extends Error {
  constructor() {
    super("Tarefa cancelada pelo usuário.");
  }
}

/** Atraso exponencial entre tentativas: 5 s, 10 s, 20 s… até 5 min. */
export function retryDelayMs(attempt: number): number {
  return Math.min(5_000 * 2 ** Math.max(0, attempt - 1), 300_000);
}
