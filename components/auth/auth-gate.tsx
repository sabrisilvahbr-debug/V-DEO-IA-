import { connection } from "next/server";
import { Info } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { configProblems, serverConfig } from "@/lib/server/config";
import { AuthForm } from "./auth-form";

/** Decide em tempo de execução entre o aviso do modo local e o formulário Supabase. */
export async function AuthGate({ mode }: { mode: "login" | "cadastro" }) {
  await connection();
  const config = serverConfig();

  if (config.backend === "local") {
    return (
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Modo local</h1>
        <div role="note" className="flex gap-3 rounded-md border border-info/30 bg-info/10 p-3 text-sm text-info">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>
            Esta instalação roda no modo local: não há contas, e os dados ficam neste computador. Para ativar login, configure o Supabase
            (veja <code>docs/supabase.md</code>).
          </p>
        </div>
        <ButtonLink href="/dashboard" className="w-full">
          Abrir o estúdio
        </ButtonLink>
      </div>
    );
  }

  const problems = configProblems(config);
  if (problems.length) {
    return (
      <div role="alert" className="w-full max-w-sm rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
        {problems.join(" ")}
      </div>
    );
  }
  return <AuthForm mode={mode} />;
}
