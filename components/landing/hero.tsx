import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { StudioPreview } from "./studio-preview";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <div>
          <Badge tone="accent">
            <span className="size-1.5 animate-pulse-soft rounded-full bg-accent" aria-hidden="true" />
            Em desenvolvimento
          </Badge>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-fg sm:text-5xl">
            Seu estúdio de pós-produção, com IA no centro da timeline.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
            O CINEMORPH AI vai reunir upload, direção de cena, transformação visual, edição e
            exportação em um só lugar, usando os modelos de vídeo que você conectar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/editor" size="lg">
              Conhecer o estúdio
              <ArrowRight aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="#roteiro" variant="secondary" size="lg">
              Ver o roteiro
            </ButtonLink>
          </div>
          <p className="mt-4 text-xs text-fg-subtle">
            Sem cadastro nesta versão. Nenhum vídeo é gerado ainda.
          </p>
        </div>
        <StudioPreview />
      </div>
    </section>
  );
}
