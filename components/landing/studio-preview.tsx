/**
 * Ilustração vetorial da interface do estúdio. Não é um vídeo nem um resultado
 * de IA — o rótulo deixa isso explícito para o visitante.
 */
export function StudioPreview() {
  const clips = [
    { track: 0, start: 2, width: 30 },
    { track: 0, start: 34, width: 22 },
    { track: 0, start: 58, width: 36 },
    { track: 1, start: 2, width: 92 },
    { track: 2, start: 10, width: 18 },
    { track: 2, start: 44, width: 24 },
  ];
  const trackColors = ["bg-accent/70", "bg-info/50", "bg-fg-subtle/50"];

  return (
    <figure className="rounded-xl border border-border-strong bg-surface p-2 shadow-2xl shadow-black/40">
      <div className="flex items-center gap-1.5 px-2 pb-2 pt-1" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
        <span className="size-2.5 rounded-full bg-border-strong" />
      </div>
      <div className="grid grid-cols-[1fr_3fr] gap-2" aria-hidden="true">
        <div className="space-y-2 rounded-md bg-canvas p-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-video rounded bg-surface-overlay" />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md bg-canvas">
            <div className="absolute inset-x-[12%] inset-y-[14%] rounded border border-dashed border-border-strong" />
            <div className="flex size-12 items-center justify-center rounded-full border border-border-strong bg-surface-raised">
              <svg viewBox="0 0 24 24" className="size-5 text-accent" fill="currentColor">
                <path d="M8 5.5v13l10.5-6.5z" />
              </svg>
            </div>
          </div>
          <div className="relative space-y-1.5 rounded-md bg-canvas p-2">
            {[0, 1, 2].map((track) => (
              <div key={track} className="relative h-4 rounded-sm bg-surface-overlay/60">
                {clips
                  .filter((clip) => clip.track === track)
                  .map((clip) => (
                    <span
                      key={`${clip.track}-${clip.start}`}
                      className={`absolute inset-y-0.5 rounded-sm ${trackColors[track]}`}
                      style={{ left: `${clip.start}%`, width: `${clip.width}%` }}
                    />
                  ))}
              </div>
            ))}
            <span className="absolute inset-y-1 left-[41%] w-px bg-accent" />
          </div>
        </div>
      </div>
      <figcaption className="px-2 pb-1 pt-2 text-xs text-fg-subtle">
        Ilustração da interface do estúdio. Não representa um vídeo gerado.
      </figcaption>
    </figure>
  );
}
