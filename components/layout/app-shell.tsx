import { Suspense, type ReactNode } from "react";
import { AppNav, AppNavLinks } from "./app-nav";
import { Logo } from "./logo";
import { ModeBanner } from "./mode-banner";

/**
 * Estrutura da área privada: barra lateral (desktop), barra inferior (celular)
 * e a faixa com o modo de execução e a sessão.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-4 md:flex">
        <Logo href="/dashboard" className="px-2" />
        <div className="mt-6 flex-1">
          <Suspense fallback={<AppNavLinks variant="sidebar" pathname={null} />}>
            <AppNav variant="sidebar" />
          </Suspense>
        </div>
        <div className="rounded-md border border-border bg-canvas p-3 text-xs leading-relaxed text-fg-subtle">
          Integrações de IA reais ainda não estão conectadas. O provedor MOCK gera apenas demonstrações.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <div className="flex h-12 items-center justify-between gap-3 border-b border-border px-4 md:hidden">
          <Logo href="/dashboard" />
        </div>
        <div
          role="status"
          className="flex min-h-9 items-center gap-2 border-b border-border bg-surface/60 px-4 py-2 text-xs text-fg-muted sm:px-6"
        >
          <Suspense fallback={null}>
            <ModeBanner />
          </Suspense>
        </div>
        <main id="conteudo" className="flex min-h-0 flex-1 flex-col">
          {children}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <Suspense fallback={<AppNavLinks variant="bar" pathname={null} />}>
          <AppNav variant="bar" />
        </Suspense>
      </div>
    </div>
  );
}
