/**
 * Configuração pública do Supabase.
 *
 * Usa apenas a URL do projeto e a chave PUBLICÁVEL, que são seguras para o
 * navegador quando o Row Level Security está ativo. Nenhuma chave secreta
 * (service_role / secret key) deve ser lida aqui.
 *
 * As variáveis são opcionais nesta etapa: sem elas, o app funciona e as telas
 * de autenticação exibem o aviso de "não configurado".
 */
export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

type EnvSource = Record<string, string | undefined>;

export function readSupabaseConfig(
  env: EnvSource = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): SupabasePublicConfig | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      return null;
    }
  } catch {
    return null;
  }

  return { url, publishableKey };
}

export function isSupabaseConfigured(env?: EnvSource): boolean {
  return readSupabaseConfig(env) !== null;
}
