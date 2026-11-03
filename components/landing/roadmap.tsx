import { Badge } from "@/components/ui/badge";
import { moduleStatusLabel, productModules } from "@/lib/modules";

export function Roadmap() {
  const done = productModules.filter((m) => m.status === "concluido").length;
  const partial = productModules.filter((m) => m.status === "parcial").length;

  return (
    <section id="roteiro" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
              Roteiro de 25 módulos
            </h2>
            <p className="mt-3 max-w-2xl text-fg-muted">
              Estado real do desenvolvimento. Nada aparece como pronto antes de funcionar.
            </p>
          </div>
          <p className="text-sm text-fg-subtle">
            {done} funcionando · {partial} parciais · {productModules.length - done - partial} planejados
          </p>
        </div>
        <ol className="mt-8 grid gap-px overflow-hidden rounded-panel border border-border bg-border sm:grid-cols-2 lg:grid-cols-3 [&>li:last-child]:sm:col-span-2 [&>li:last-child]:lg:col-span-1">
          {productModules.map((module) => (
            <li
              key={module.id}
              className="flex items-center justify-between gap-3 bg-surface px-4 py-3"
              title={module.note}
            >
              <span className="flex items-center gap-3 text-sm text-fg">
                <span className="font-mono text-xs text-fg-subtle">
                  {String(module.id).padStart(2, "0")}
                </span>
                {module.name}
              </span>
              <Badge tone={module.status === "concluido" ? "success" : module.status === "parcial" ? "warning" : "neutral"}>
                {moduleStatusLabel[module.status]}
              </Badge>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
