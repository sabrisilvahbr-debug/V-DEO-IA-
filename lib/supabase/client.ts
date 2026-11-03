import { createBrowserClient } from "@supabase/ssr";
import { readSupabaseConfig } from "./config";

/**
 * Cliente Supabase para Client Components.
 * Retorna `null` enquanto o projeto não estiver configurado, para que a
 * interface possa exibir um estado de indisponibilidade em vez de quebrar.
 */
export function createSupabaseBrowserClient() {
  const config = readSupabaseConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.publishableKey);
}
