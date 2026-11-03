import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PanelProps = Omit<ComponentProps<"section">, "title"> & {
  title: ReactNode;
  actions?: ReactNode;
  bodyClassName?: string;
};

/** Painel de estúdio: cabeçalho compacto e corpo rolável. */
export function Panel({ title, actions, className, bodyClassName, children, ...props }: PanelProps) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface",
        className,
      )}
      {...props}
    >
      <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{title}</h2>
        {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
      </header>
      <div className={cn("min-h-0 flex-1 overflow-auto", bodyClassName)}>{children}</div>
    </section>
  );
}
