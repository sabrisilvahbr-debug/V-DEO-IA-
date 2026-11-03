import "server-only";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getRequestContext, type RequestContext } from "./context";
import { RateLimitError } from "./rate-limit";
import { SetupError } from "./setup-error";

/** Erro com status HTTP e mensagem segura para o usuário. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = "erro",
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string, code = "erro", details?: unknown) {
  return Response.json({ error: { code, message, details } }, { status });
}

export function toErrorResponse(error: unknown): Response {
  unstable_rethrow(error); // sinais internos do Next (redirect, renderização dinâmica etc.)
  if (error instanceof HttpError) return jsonError(error.status, error.message, error.code, error.details);
  if (error instanceof RateLimitError) {
    return Response.json(
      { error: { code: "limite_de_requisicoes", message: error.message } },
      { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
    );
  }
  if (error instanceof SetupError) {
    console.error(`[setup] ${error.message} ${error.fix}`);
    return jsonError(503, error.message, "ambiente", { hint: error.fix });
  }
  if (error instanceof ZodError) {
    return jsonError(400, "Dados inválidos.", "validacao", error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  console.error("[api] erro inesperado:", error instanceof Error ? error.message : error);
  return jsonError(500, "Erro interno. Tente novamente.", "interno");
}

/**
 * Envolve um Route Handler: resolve o usuário (401 sem sessão) e converte
 * erros em respostas JSON padronizadas.
 */
export function withAuth<P>(
  handler: (request: Request, ctx: RequestContext, params: P) => Promise<Response>,
) {
  return async (request: Request, route: { params: Promise<P> }) => {
    try {
      await connection(); // a API sempre responde por requisição, nunca é pré-renderizada
      const ctx = await getRequestContext();
      if (!ctx) return jsonError(401, "Faça login para continuar.", "nao_autenticado");
      return await handler(request, ctx, await route.params);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "Corpo da requisição precisa ser JSON.", "json_invalido");
  }
  return schema.parse(body);
}

export function notFound(what = "Recurso"): never {
  throw new HttpError(404, `${what} não encontrado.`, "nao_encontrado");
}
