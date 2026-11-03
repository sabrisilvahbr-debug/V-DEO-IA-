"use client";

import { RotateCw, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Erro inesperado em qualquer página: oferece tentar de novo e o diagnóstico. */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex min-h-dvh max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-fg">Não foi possível abrir esta página</h1>
      <p className="text-sm text-fg-muted">
        Algo deu errado ao carregar os dados. A página de diagnóstico verifica Node.js, banco local, pasta de dados e FFmpeg e
        mostra como corrigir.
      </p>
      {process.env.NODE_ENV !== "production" ? (
        <pre className="max-w-full overflow-auto rounded-md border border-border bg-canvas p-3 text-left text-xs text-danger">{error.message}</pre>
      ) : error.digest ? (
        <p className="font-mono text-xs text-fg-subtle">Código: {error.digest}</p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>
          <RotateCw aria-hidden="true" />
          Tentar novamente
        </Button>
        <Link
          href="/diagnostico"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border-strong bg-surface-raised px-4 text-sm font-medium text-fg hover:bg-surface-overlay"
        >
          <Stethoscope aria-hidden="true" className="size-4" />
          Abrir diagnóstico
        </Link>
      </div>
    </div>
  );
}
