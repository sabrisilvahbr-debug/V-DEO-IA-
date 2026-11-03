const steps = [
  { title: "Envie", description: "Seu vídeo, imagens de referência ou apenas uma ideia." },
  { title: "Dirija", description: "Descreva a cena e escolha estilo, formato e modelo." },
  { title: "Confirme", description: "Veja o custo estimado antes de iniciar qualquer geração paga." },
  { title: "Edite e exporte", description: "Monte a sequência e exporte em vertical, quadrado ou horizontal." },
];

export function Workflow() {
  return (
    <section id="como-funciona" className="scroll-mt-20 border-b border-border bg-surface/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Como vai funcionar</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className="font-mono text-sm text-accent">0{index + 1}</span>
              <h3 className="mt-2 font-semibold text-fg">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
