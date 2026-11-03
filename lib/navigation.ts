import {
  Clapperboard,
  FolderOpen,
  LayoutDashboard,
  Library,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Itens da navegação lateral da área privada. */
export const appNavItems: AppNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projetos", label: "Projetos", icon: FolderOpen },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
  { href: "/editor", label: "Editor", icon: Clapperboard },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

/**
 * Indica se um item de navegação corresponde à rota atual.
 * Considera sub-rotas (ex.: /projetos/123 ativa "Projetos").
 */
export function isNavItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
