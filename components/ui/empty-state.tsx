import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  /**
   * Identifica funcionalidades que ainda não existem. Quando informado,
   * exibe um selo "Em desenvolvimento · Etapa N" para não sugerir que o
   * recurso já funciona.
   */
  plannedStage?: number;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  plannedStage,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full border border-border-strong bg-surface-raised text-fg-muted">
        <Icon aria-hidden="true" className="size-5" />
      </div>
      {plannedStage !== undefined ? (
        <Badge tone="warning">Em desenvolvimento · Etapa {plannedStage}</Badge>
      ) : null}
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <p className="max-w-sm text-sm leading-relaxed text-fg-muted">{description}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
