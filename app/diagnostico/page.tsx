import type { Metadata } from "next";
import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui/button";
import { runDiagnostics, type Check } from "@/lib/server/diagnostics";

export const metadata: Metadata = { title: "Diagnóstico" };

const icons = { ok: CheckCircle2, warning: CircleAlert, error: CircleX } as const;
const colors = { ok: "text-success", warning: "text-warning", error: "text-danger" } as const;

export default function DiagnosticsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-4 sm:px-6">
        <Logo />
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Diagnóstico do ambiente</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Verifica o que o CINEMORPH AI precisa para funcionar neste computador ou servidor.
        </p>
        <Suspense fallback={<p className="mt-8 text-sm text-fg-subtle">Verificando…</p>}>
          <Results />
        </Suspense>
      </main>
    </div>
  );
}

async function Results() {
  await connection();
  const checks = await runDiagnostics();
  const blocking = checks.filter((c) => c.status === "error" && c.id !== "ffmpeg");
  return (
    <>
      <ul className="mt-8 divide-y divide-border rounded-panel border border-border bg-surface">
        {checks.map((check) => (
          <CheckRow key={`${check.id}-${check.detail}`} check={check} />
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {blocking.length === 0 ? (
          <ButtonLink href="/dashboard">Abrir o estúdio</ButtonLink>
        ) : (
          <p className="text-sm text-danger">Corrija os itens em vermelho e reinicie o servidor (Ctrl+C e `npm run dev:all`).</p>
        )}
        <ButtonLink href="/diagnostico" variant="secondary">
          Verificar novamente
        </ButtonLink>
      </div>
    </>
  );
}

function CheckRow({ check }: { check: Check }) {
  const Icon = icons[check.status];
  return (
    <li className="flex gap-3 p-4">
      <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${colors[check.status]}`} />
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-medium text-fg">
          {check.label}
          <span className="sr-only"> — {check.status === "ok" ? "ok" : check.status === "warning" ? "atenção" : "erro"}</span>
        </p>
        <p className="break-words text-fg-muted">{check.detail}</p>
        {check.fix ? <p className="break-words text-fg-subtle">{check.fix}</p> : null}
      </div>
    </li>
  );
}
