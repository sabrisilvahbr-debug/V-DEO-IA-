"use client";

import { ArrowLeft, ArrowRight, AudioLines, Captions, Copy, Film, Scissors, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { clipDuration, clipStartTimes, formatTimecode, timelineDuration, type Timeline } from "@/lib/domain/timeline";
import type { MediaAsset } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const LABEL_WIDTH = 104;

export function TimelineEditor({
  timeline,
  assets,
  selectedClipId,
  playhead,
  zoom,
  onZoom,
  onSelect,
  onSeek,
  onMove,
  onSplit,
  onDuplicate,
  onRemove,
}: {
  timeline: Timeline;
  assets: Map<string, MediaAsset>;
  selectedClipId: string | null;
  playhead: number;
  zoom: number;
  onZoom: (zoom: number) => void;
  onSelect: (clipId: string | null) => void;
  onSeek: (seconds: number) => void;
  onMove: (direction: -1 | 1) => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const total = timelineDuration(timeline);
  const starts = clipStartTimes(timeline);
  const width = Math.max(600, (total + 2) * zoom);
  const step = zoom >= 60 ? 1 : zoom >= 25 ? 5 : 10;
  const marks = Array.from({ length: Math.floor((total + 2) / step) + 1 }, (_, i) => i * step);
  const selectedIndex = timeline.clips.findIndex((c) => c.id === selectedClipId);
  const music = timeline.music ? assets.get(timeline.music.assetId) : null;

  const seekFromEvent = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(total, (event.clientX - rect.left) / zoom)));
  };

  const onClipKey = (event: KeyboardEvent, clipId: string) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onSelect(clipId);
      onRemove();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        <span className="mr-2 font-mono text-xs tabular-nums text-fg-muted">Total {formatTimecode(total)}</span>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={selectedIndex <= 0} onClick={() => onMove(-1)} aria-label="Mover clipe para a esquerda">
          <ArrowLeft />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          disabled={selectedIndex < 0 || selectedIndex >= timeline.clips.length - 1}
          onClick={() => onMove(1)}
          aria-label="Mover clipe para a direita"
        >
          <ArrowRight />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={selectedIndex < 0} onClick={onSplit} title="Dividir no ponto de reprodução">
          <Scissors aria-hidden="true" />
          Dividir
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={selectedIndex < 0} onClick={onDuplicate}>
          <Copy aria-hidden="true" />
          Duplicar
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={selectedIndex < 0} onClick={onRemove}>
          <Trash2 aria-hidden="true" />
          Remover
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" className="size-7" aria-label="Diminuir zoom" onClick={() => onZoom(Math.max(8, zoom / 1.5))}>
            <ZoomOut />
          </Button>
          <Button size="icon" variant="ghost" className="size-7" aria-label="Aumentar zoom" onClick={() => onZoom(Math.min(200, zoom * 1.5))}>
            <ZoomIn />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width: width + LABEL_WIDTH }}>
          {/* Régua */}
          <div className="sticky top-0 z-10 flex border-b border-border bg-surface">
            <div className="shrink-0 border-r border-border" style={{ width: LABEL_WIDTH }} />
            <div className="relative h-6 cursor-pointer" style={{ width }} onClick={seekFromEvent} role="presentation">
              {marks.map((m) => (
                <span key={m} className="absolute top-1 -translate-x-1/2 font-mono text-[10px] text-fg-subtle" style={{ left: m * zoom }}>
                  {formatTimecode(m).slice(3)}
                </span>
              ))}
            </div>
          </div>

          {/* Faixa de vídeo */}
          <TrackRow icon={Film} label="Vídeo">
            <div className="relative h-14" style={{ width }} onClick={(e) => e.target === e.currentTarget && onSelect(null)} role="presentation">
              {timeline.clips.length === 0 ? (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-fg-subtle">Adicione mídias pelo painel ao lado</span>
              ) : null}
              <ul aria-label="Clipes da timeline" className="contents">
                {timeline.clips.map((clip, i) => {
                  const asset = assets.get(clip.assetId);
                  const selected = clip.id === selectedClipId;
                  return (
                    <li key={clip.id} className="absolute inset-y-1" style={{ left: starts[i] * zoom, width: Math.max(4, clipDuration(clip) * zoom - 2) }}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={`Clipe ${i + 1}: ${asset?.originalName ?? "mídia"}, ${clipDuration(clip).toFixed(1)} segundos`}
                        onClick={() => onSelect(clip.id)}
                        onKeyDown={(e) => onClipKey(e, clip.id)}
                        className={cn(
                          "relative flex size-full items-end overflow-hidden rounded border text-left",
                          selected ? "border-accent ring-1 ring-accent" : "border-accent/30 hover:border-accent/70",
                          asset?.isDemo ? "bg-warning/20" : "bg-accent/20",
                        )}
                      >
                        {asset?.thumbnailKey ? (
                          // eslint-disable-next-line @next/next/no-img-element -- miniatura privada
                          <img src={`/api/media/${asset.id}?variant=thumb`} alt="" className="absolute inset-0 size-full object-cover opacity-40" />
                        ) : null}
                        <span className="relative truncate px-1.5 pb-1 text-[10px] font-medium text-fg">
                          {asset?.originalName ?? "Mídia ausente"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </TrackRow>

          {/* Faixa de legendas */}
          <TrackRow icon={Captions} label="Legendas">
            <div className="relative h-8" style={{ width }}>
              {timeline.subtitles.map((s) => (
                <span
                  key={s.id}
                  className="absolute inset-y-1 truncate rounded bg-fg-subtle/30 px-1 text-[10px] leading-6 text-fg"
                  style={{ left: s.start * zoom, width: Math.max(4, (s.end - s.start) * zoom - 2) }}
                  title={s.text}
                >
                  {s.text}
                </span>
              ))}
            </div>
          </TrackRow>

          {/* Trilha */}
          <TrackRow icon={AudioLines} label="Trilha">
            <div className="relative h-8" style={{ width }}>
              {music ? (
                <span className="absolute inset-y-1 left-0 truncate rounded bg-info/30 px-1.5 text-[10px] leading-6 text-fg" style={{ width: Math.max(40, total * zoom) }}>
                  {music.originalName} · volume {Math.round((timeline.music?.volume ?? 0) * 100)}%
                </span>
              ) : (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-fg-subtle">Sem trilha</span>
              )}
            </div>
          </TrackRow>

          {/* Cursor de reprodução */}
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-accent"
            style={{ left: LABEL_WIDTH + playhead * zoom }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}

function TrackRow({ icon: Icon, label, children }: { icon: typeof Film; label: string; children: React.ReactNode }) {
  return (
    <div className="flex border-b border-border/70">
      <div className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border bg-surface px-3 text-xs text-fg-muted" style={{ width: LABEL_WIDTH }}>
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </div>
      {children}
    </div>
  );
}
