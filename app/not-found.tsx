import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="conteudo" className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="text-2xl font-semibold text-fg">Página não encontrada</h1>
      <p className="max-w-sm text-fg-muted">O endereço acessado não existe ou foi movido.</p>
      <ButtonLink href="/" variant="secondary">
        Voltar ao início
      </ButtonLink>
    </main>
  );
}
