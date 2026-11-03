import {
  Captions,
  Clapperboard,
  Layers,
  Route,
  ShieldCheck,
  Wand2,
  type LucideIcon,
} from "lucide-react";

type Feature = { icon: LucideIcon; title: string; description: string };

const features: Feature[] = [
  {
    icon: Wand2,
    title: "Transformação visual",
    description:
      "Envie um vídeo próprio e aplique estilos e figurinos com modelos que suportem vídeo para vídeo.",
  },
  {
    icon: Clapperboard,
    title: "Direção de cena",
    description:
      "Descreva a cena em português e revise o prompt estruturado de câmera, luz e movimento.",
  },
  {
    icon: Layers,
    title: "Timeline de edição",
    description: "Organize clipes, ajuste entradas e saídas e acompanhe a duração total.",
  },
  {
    icon: Captions,
    title: "Legendas e áudio",
    description: "Transcrição quando configurada, edição manual e ajuste de faixas de áudio.",
  },
  {
    icon: Route,
    title: "Vários provedores",
    description:
      "Uma camada independente escolhe o modelo por capacidade e custo, sem prender você a um fornecedor.",
  },
  {
    icon: ShieldCheck,
    title: "Custos e consentimento",
    description:
      "Estimativa e confirmação antes de qualquer operação paga, e registro de consentimento de imagem e voz.",
  },
];

export function Features() {
  return (
    <section id="recursos" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
          O que o estúdio faz
        </h2>
        <p className="mt-3 max-w-2xl text-fg-muted">
          Timeline, cortes, legendas, cor e exportação já funcionam. A geração e a transformação por IA
          serão ativadas à medida que cada integração real for verificada.
        </p>
        <ul className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <li key={title} className="border-l border-border-strong pl-5">
              <Icon aria-hidden="true" className="size-5 text-accent" />
              <h3 className="mt-3 font-semibold text-fg">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
