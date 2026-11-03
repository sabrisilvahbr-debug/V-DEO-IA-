import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-fg-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Logo />
        <p>Projeto em desenvolvimento. Nenhum recurso de IA está ativo nesta versão.</p>
      </div>
    </footer>
  );
}
