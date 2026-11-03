import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/components/auth/auth-form";
import { AppNav } from "@/components/layout/app-nav";
import { StudioWorkspace } from "@/components/studio/studio-workspace";
import HomePage from "@/app/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/editor",
}));

describe("Landing page", () => {
  it("apresenta o título principal e as chamadas para ação", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/estúdio de pós-produção/);
    expect(screen.getByRole("link", { name: /Conhecer o estúdio/ })).toHaveAttribute("href", "/editor");
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
  it("mantém o formulário desabilitado enquanto a autenticação não existe", () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByRole("button", { name: "Entrar" })).toBeDisabled();
    expect(screen.getByLabelText("E-mail")).toBeDisabled();
    expect(screen.getByRole("note")).toHaveTextContent(/não está ativa/);
  });

  it("exibe o campo de nome somente no cadastro", () => {
    render(<AuthForm mode="cadastro" />);
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
  });
});

describe("StudioWorkspace", () => {
  it("não simula vídeo: exibe preview vazio e controles desabilitados", () => {
    render(<StudioWorkspace />);
    expect(screen.getByText("Nenhum vídeo carregado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reproduzir" })).toBeDisabled();
    expect(screen.getByRole("list", { name: "Faixas da timeline" }).children).toHaveLength(3);
  });
});
