import Link from "next/link";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type AuthFormProps = {
  mode: "login" | "cadastro";
};

/**
 * Formulário de autenticação desabilitado. A lógica real (Supabase Auth) será
 * implementada na etapa 3; até lá, nenhum dado é enviado.
 */
export function AuthForm({ mode }: AuthFormProps) {
  const isLogin = mode === "login";

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">
        {isLogin ? "Entrar" : "Criar conta"}
      </h1>
      <p className="mt-1.5 text-sm text-fg-muted">
        {isLogin ? "Acesse seus projetos no estúdio." : "Comece a criar no CINEMORPH AI."}
      </p>

      <div
        role="note"
        className="mt-6 flex gap-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning"
      >
        <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>
          A autenticação ainda não está ativa. O formulário está desabilitado e nenhum dado é
          enviado.
        </p>
      </div>

      <form className="mt-6 space-y-4">
        <fieldset disabled className="space-y-4">
          {!isLogin ? (
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" autoComplete="name" />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>
          <Button type="submit" className="w-full">
            {isLogin ? "Entrar" : "Criar conta"}
          </Button>
        </fieldset>
      </form>

      <p className="mt-6 text-sm text-fg-muted">
        {isLogin ? "Ainda não tem conta? " : "Já tem conta? "}
        <Link
          href={isLogin ? "/cadastro" : "/login"}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          {isLogin ? "Criar conta" : "Entrar"}
        </Link>
      </p>
    </div>
  );
}
