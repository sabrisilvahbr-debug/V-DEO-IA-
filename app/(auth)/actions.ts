"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { serverConfig } from "@/lib/server/config";
import { checkRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null; message: string | null };

const credentials = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").max(254),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(72),
});

async function client() {
  if (serverConfig().backend !== "supabase") return null;
  return createSupabaseServerClient();
}

function guard(key: string): string | null {
  try {
    checkRateLimit(key, 10, 60_000);
    return null;
  } catch (error) {
    return error instanceof RateLimitError ? error.message : "Tente novamente.";
  }
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, message: null };
  const limited = guard(`login:${parsed.data.email}`);
  if (limited) return { error: limited, message: null };

  const supabase = await client();
  if (!supabase) return { error: "A autenticação não está ativa nesta instalação.", message: null };
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha incorretos.", message: null };
  redirect("/dashboard");
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, message: null };
  const limited = guard(`signup:${parsed.data.email}`);
  if (limited) return { error: limited, message: null };

  const supabase = await client();
  if (!supabase) return { error: "A autenticação não está ativa nesta instalação.", message: null };
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) return { error: "Não foi possível criar a conta. Verifique os dados e tente novamente.", message: null };
  if (!data.session) {
    return { error: null, message: "Conta criada. Confirme o cadastro pelo link enviado ao seu e-mail e depois entre." };
  }
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await client();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}
