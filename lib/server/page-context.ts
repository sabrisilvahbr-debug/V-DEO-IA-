import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getRequestContext, type RequestContext } from "./context";

/**
 * Contexto para Server Components de páginas privadas. Deve ser chamado
 * dentro de um <Suspense>, pois lê dados por requisição (Cache Components).
 * Sem sessão, redireciona para o login.
 */
export async function requirePageContext(): Promise<RequestContext> {
  await connection();
  const ctx = await getRequestContext();
  if (!ctx) redirect("/login");
  return ctx;
}
