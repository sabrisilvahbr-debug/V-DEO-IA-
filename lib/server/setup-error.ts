/**
 * Problema no ambiente (versão do Node, dependência ausente, pasta sem
 * permissão…). A mensagem é segura para exibir e diz como corrigir.
 */
export class SetupError extends Error {
  constructor(
    message: string,
    readonly fix: string,
  ) {
    super(message);
    this.name = "SetupError";
  }
}
