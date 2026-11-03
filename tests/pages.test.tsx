import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/auth/auth-form";
import { TimelineEditor } from "@/components/studio/timeline-editor";
import { emptyTimeline } from "@/lib/domain/timeline";
import { AppNav } from "@/components/layout/app-nav";
import HomePage from "@/app/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/editor",
}));

describe("Landing page", () => {
  it("apresenta o título principal e as chamadas para ação", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/estúdio de pós-produção/);
    expect(screen.getByRole("link", { name: /Criar um projeto/ })).toHaveAttribute("href", "/projetos");
  });

  it("identifica a ilustração como não sendo um vídeo gerado", () => {
    render(<HomePage />);
    expect(screen.getByText(/Não representa um vídeo gerado/)).toBeInTheDocument();
  });

  it("mostra os 25 módulos do roteiro", () => {
    render(<HomePage />);
    const roadmap = document.getElementById("roteiro");
    expect(roadmap?.querySelectorAll("ol > li")).toHaveLength(25);
  });
});

describe("AppNav", () => {
  it("marca a rota atual com aria-current", () => {
    render(<AppNav variant="sidebar" />);
    expect(screen.getByRole("link", { name: "Editor" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });
});

describe("AuthForm", () => {
  it("renderiza e-mail e senha habilitados", () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByLabelText("E-mail")).toBeEnabled();
    expect(screen.getByLabelText("Senha")).toHaveAttribute("minLength", "8");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });
});

describe("TimelineEditor", () => {
  const noop = () => {};
  it("mostra estado vazio e desabilita ações sem clipe selecionado", () => {
    render(
      <TimelineEditor
        timeline={emptyTimeline()}
        assets={new Map()}
        selectedClipId={null}
        playhead={0}
        zoom={40}
        onZoom={noop}
        onSelect={noop}
        onSeek={noop}
        onMove={noop}
        onSplit={noop}
        onDuplicate={noop}
        onRemove={noop}
      />,
    );
    expect(screen.getByText("Adicione mídias pelo painel ao lado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remover/ })).toBeDisabled();
  });

  it("lista os clipes com nome e duração acessíveis", () => {
    const timeline = {
      ...emptyTimeline(),
      clips: [{ id: "c1", assetId: "a1", kind: "video" as const, in: 1, out: 4, volume: 1, muted: false, color: { brightness: 0, contrast: 1, saturation: 1 } }],
    };
    const asset = { id: "a1", originalName: "praia.mp4", thumbnailKey: null, isDemo: false } as never;
    render(
      <TimelineEditor
        timeline={timeline}
        assets={new Map([["a1", asset]])}
        selectedClipId="c1"
        playhead={0}
        zoom={40}
        onZoom={noop}
        onSelect={noop}
        onSeek={noop}
        onMove={noop}
        onSplit={noop}
        onDuplicate={noop}
        onRemove={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "Clipe 1: praia.mp4, 3.0 segundos" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Remover/ })).toBeEnabled();
  });
});
