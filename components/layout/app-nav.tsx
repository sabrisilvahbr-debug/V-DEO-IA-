"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { appNavItems, isNavItemActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

type AppNavProps = {
  /** "sidebar" para telas largas; "bar" para a barra inferior no celular. */
  variant: "sidebar" | "bar";
};

/** Navegação com o item ativo destacado (lê a URL; fica dentro de <Suspense>). */
export function AppNav({ variant }: AppNavProps) {
  return <AppNavLinks variant={variant} pathname={usePathname()} />;
}

/** Links sem leitura da URL: usado como fallback pré-renderizado. */
export function AppNavLinks({ variant, pathname }: AppNavProps & { pathname: string | null }) {
  const isBar = variant === "bar";

  return (
    <nav aria-label="Navegação principal">
      <ul className={cn(isBar ? "grid grid-cols-5" : "flex flex-col gap-0.5")}>
        {appNavItems.map(({ href, label, icon: Icon }) => {
          const active = isNavItemActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center rounded-md text-sm transition-colors",
                  isBar
                    ? "flex-col gap-1 px-1 py-2 text-[11px]"
                    : "gap-3 px-3 py-2",
                  active
                    ? "bg-surface-raised text-fg"
                    : "text-fg-muted hover:bg-surface-raised/60 hover:text-fg",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn("size-4 shrink-0", active && "text-accent")}
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
