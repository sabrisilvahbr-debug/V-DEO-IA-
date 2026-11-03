import { ButtonLink } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section>
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between md:py-20">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            Comece pelo estúdio
          </h2>
          <p className="mt-2 text-fg-muted">
            Explore a interface agora. Projetos e geração serão liberados nas próximas etapas.
          </p>
        </div>
        <ButtonLink href="/dashboard" size="lg">
          Iniciar um projeto
        </ButtonLink>
      </div>
    </section>
  );
}
