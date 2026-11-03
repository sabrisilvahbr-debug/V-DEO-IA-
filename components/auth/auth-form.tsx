"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/form-controls";
import { Input, Label } from "@/components/ui/input";

type AuthFormProps = { mode: "login" | "cadastro" };

const initial: AuthState = { error: null, message: null };

/** Login/cadastro com Supabase Auth (e-mail e senha). */
export function AuthForm({ mode }: AuthFormProps) {
  const isLogin = mode === "login";
  const [state, action, pending] = useActionState(isLogin ? signIn : signUp, initial);

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">{isLogin ? "Entrar" : "Criar conta"}</h1>
      <p className="mt-1.5 text-sm text-fg-muted">{isLogin ? "Acesse seus projetos no estúdio." : "Comece a criar no CINEMORPH AI."}</p>

      <form action={action} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" minLength={8} autoComplete={isLogin ? "current-password" : "new-password"} required />
        </div>
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        {state.message ? <Alert tone="success">{state.message}</Alert> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Aguarde…" : isLogin ? "Entrar" : "Criar conta"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-fg-muted">
        {isLogin ? "Ainda não tem conta? " : "Já tem conta? "}
        <Link href={isLogin ? "/cadastro" : "/login"} className="font-medium text-accent underline-offset-4 hover:underline">
          {isLogin ? "Criar conta" : "Entrar"}
        </Link>
      </p>
    </div>
  );
}
