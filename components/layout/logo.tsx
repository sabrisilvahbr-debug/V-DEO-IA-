import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect width="32" height="32" rx="7" fill="var(--color-surface-raised)" />
      <rect
        x="5"
        y="9"
        width="16"
        height="14"
        rx="3"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2.4"
      />
      <path d="M21 14.5 27 11v10l-6-3.5z" fill="var(--color-accent)" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2.5 rounded-md", className)}
      aria-label="CINEMORPH AI — página inicial"
    >
      <LogoMark />
      <span className="whitespace-nowrap text-sm font-semibold tracking-[0.14em] text-fg sm:tracking-[0.18em]">
        CINEMORPH <span className="text-accent">AI</span>
      </span>
    </Link>
  );
}
