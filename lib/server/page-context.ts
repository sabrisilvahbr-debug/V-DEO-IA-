import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getRequestContext, type RequestContext } from "./context";
import { SetupError } from "./setup-error";

/**
 * Contexto para Server Components de páginas privadas. Deve ser chamado
 * dentro de um <Suspense>, pois lê dados por requisição (Cache Components).
 * Sem sessão, redireciona para o login.
 */
export async function requirePageContext(): Promise<RequestContext> {
  await connection();
  let ctx: RequestContext | null;
  try {
    ctx = await getRequestContext();
  } catch (error) {
    // Problema de ambiente: mostra a página de diagnóstico com a correção.
    if (error instanceof SetupError) {
      console.error(`[setup] ${error.message} ${error.fix}`);
      redirect("/diagnostico");
    }
    throw error;
  }
  if (!ctx) redirect("/login");
  return ctx;
}
