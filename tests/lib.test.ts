import { describe, expect, it } from "vitest";
import { productModules } from "@/lib/modules";
import { appNavItems, isNavItemActive } from "@/lib/navigation";
import { isSupabaseConfigured, readSupabaseConfig } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("resolve conflitos do Tailwind mantendo a última classe", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", false && "hidden", "font-bold")).toBe("text-sm font-bold");
  });
});

describe("isNavItemActive", () => {
  it("ativa a rota exata e sub-rotas", () => {
    expect(isNavItemActive("/projetos", "/projetos")).toBe(true);
    expect(isNavItemActive("/projetos/abc", "/projetos")).toBe(true);
  });

  it("não ativa rotas com prefixo parecido", () => {
    expect(isNavItemActive("/projetos-antigos", "/projetos")).toBe(false);
    expect(isNavItemActive(null, "/projetos")).toBe(false);
  });

  it("possui as cinco rotas privadas previstas", () => {
    expect(appNavItems.map((item) => item.href)).toEqual([
      "/dashboard",
      "/projetos",
      "/biblioteca",
      "/editor",
      "/configuracoes",
    ]);
  });
});

describe("readSupabaseConfig", () => {
  it("retorna null sem variáveis", () => {
    expect(readSupabaseConfig({})).toBeNull();
    expect(isSupabaseConfigured({})).toBe(false);
  });

  it("retorna null com valores vazios ou só espaços", () => {
    expect(
      readSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "  ",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "chave",
      }),
    ).toBeNull();
  });

  it("rejeita URL inválida ou sem HTTPS", () => {
    expect(
      readSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "não é url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "chave",
      }),
    ).toBeNull();
    expect(
      readSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "http://exemplo.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "chave",
      }),
    ).toBeNull();
  });

  it("aceita HTTPS e o Supabase local", () => {
    expect(
      readSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://exemplo.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "chave",
      }),
    ).toEqual({ url: "https://exemplo.supabase.co", publishableKey: "chave" });
    expect(
      isSupabaseConfigured({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "chave",
      }),
    ).toBe(true);
  });
});

describe("productModules", () => {
  it("lista 25 módulos com ids únicos e sequenciais", () => {
    expect(productModules).toHaveLength(25);
    expect(productModules.map((m) => m.id)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it("explica o que falta em todo módulo parcial", () => {
    for (const m of productModules.filter((x) => x.status === "parcial")) expect(m.note, m.name).toBeTruthy();
  });
});
