import { render, screen } from "@testing-library/react";
import { Film } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";

describe("Button", () => {
  it("usa type=button por padrão para não enviar formulários sem querer", () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveAttribute("type", "button");
  });

  it("respeita o estado desabilitado", () => {
    render(<Button disabled>Exportar</Button>);
    expect(screen.getByRole("button", { name: "Exportar" })).toBeDisabled();
  });

  it("aplica a variante solicitada", () => {
    render(<Button variant="secondary">Cancelar</Button>);
    expect(screen.getByRole("button", { name: "Cancelar" }).className).toContain("bg-surface-raised");
  });
});

describe("ButtonLink", () => {
  it("renderiza um link navegável", () => {
    render(<ButtonLink href="/editor">Abrir</ButtonLink>);
    expect(screen.getByRole("link", { name: "Abrir" })).toHaveAttribute("href", "/editor");
  });
});

describe("EmptyState", () => {
  it("identifica funcionalidades ainda não implementadas", () => {
    render(
      <EmptyState icon={Film} title="Sem vídeos" description="Envie um arquivo." plannedStage={3} />,
    );
    expect(screen.getByText("Em desenvolvimento · Etapa 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sem vídeos" })).toBeInTheDocument();
  });

  it("não exibe selo quando a etapa não é informada", () => {
    render(<EmptyState icon={Film} title="Vazio" description="Nada aqui." />);
    expect(screen.queryByText(/Em desenvolvimento/)).not.toBeInTheDocument();
  });
});

describe("Panel e Badge", () => {
  it("renderiza título e conteúdo do painel", () => {
    render(<Panel title="Timeline">conteúdo</Panel>);
    expect(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("renderiza o selo com o texto informado", () => {
    render(<Badge tone="success">Pronto</Badge>);
    expect(screen.getByText("Pronto")).toBeInTheDocument();
  });
});
