import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readSupabaseConfig } from "./config";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Retorna `null` enquanto o projeto não estiver configurado.
 *
 * A atualização da sessão por requisição (arquivo `proxy.ts`) será adicionada
 * na etapa de autenticação.
 */
export async function createSupabaseServerClient() {
  const config = readSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não podem gravar cookies. A gravação será feita
          // pelo proxy de sessão na etapa de autenticação.
        }
      },
    },
  });
}
