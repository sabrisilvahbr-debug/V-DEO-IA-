"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-md border border-border-strong bg-canvas px-3 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClass, "h-9 pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldClass, "min-h-20 py-2 leading-relaxed", className)} {...props} />;
}

export function NumberInput({ className, ...props }: ComponentProps<"input">) {
  return <input type="number" className={cn(fieldClass, "h-8 font-mono tabular-nums", className)} {...props} />;
}

type FieldProps = { label: string; hint?: ReactNode; children: (id: string) => ReactNode; className?: string };

/** Rótulo + controle + dica, com ids associados para acessibilidade. */
export function Field({ label, hint, children, className }: FieldProps) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-xs font-medium text-fg-muted">
        {label}
      </label>
      {children(id)}
      {hint ? <p className="text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

type SliderProps = Omit<ComponentProps<"input">, "onChange" | "value"> & {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  format?: (value: number) => string;
};

export function Slider({ label, value, onValueChange, format, className, ...props }: SliderProps) {
  const id = useId();
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs">
        <label htmlFor={id} className="font-medium text-fg-muted">
          {label}
        </label>
        <span className="font-mono tabular-nums text-fg-subtle">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        value={value}
        onChange={(e) => onValueChange(Number(e.target.value))}
        className="w-full accent-[var(--color-accent)]"
        {...props}
      />
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" {...props} />
      <label htmlFor={id} className="text-xs leading-relaxed text-fg-muted">
        {label}
      </label>
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-overlay"
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${percent}%` }} />
    </div>
  );
}

type Tone = "info" | "warning" | "danger" | "success";
const toneClass: Record<Tone, string> = {
  info: "border-info/30 bg-info/10 text-info",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  success: "border-success/30 bg-success/10 text-success",
};

export function Alert({ tone = "info", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-md border px-3 py-2 text-xs leading-relaxed", toneClass[tone], className)}>
      {children}
    </div>
  );
}

type Tab<T extends string> = { id: T; label: string; badge?: ReactNode };

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 border-b border-border px-2">
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              const index = tabs.findIndex((t) => t.id === value);
              const next = tabs[(index + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
              onChange(next.id);
            }}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "-mb-px flex h-10 items-center gap-1.5 border-b-2 px-2.5 text-xs font-semibold uppercase tracking-wider transition-colors",
              selected ? "border-accent text-fg" : "border-transparent text-fg-subtle hover:text-fg-muted",
            )}
          >
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}
