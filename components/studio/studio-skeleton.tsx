/** Esqueleto exibido enquanto os dados do estúdio carregam. */
export function StudioSkeleton() {
  const block = "animate-pulse-soft rounded-panel border border-border bg-surface";
  return (
    <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[19rem_minmax(0,1fr)_19rem] lg:grid-rows-[minmax(0,1fr)_15rem]" aria-busy="true" aria-label="Carregando estúdio">
      <div className={`${block} min-h-64`} />
      <div className={`${block} min-h-64`} />
      <div className={`${block} min-h-64`} />
      <div className={`${block} min-h-40 lg:col-span-3`} />
    </div>
  );
}
