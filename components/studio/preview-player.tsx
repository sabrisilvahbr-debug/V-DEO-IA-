"use client";

import { Pause, Play, SkipBack, Video } from "lucide-react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { clipDuration, clipStartTimes, formatTimecode, timelineDuration, type Clip, type Timeline } from "@/lib/domain/timeline";
import { locateTime } from "@/lib/domain/timeline-ops";
import type { MediaAsset } from "@/lib/domain/types";

/** Aproximação da correção de cor do FFmpeg usando filtros CSS (somente preview). */
function cssFilter(clip: Clip | undefined): string | undefined {
  if (!clip) return undefined;
  const { brightness, contrast, saturation } = clip.color;
  if (brightness === 0 && contrast === 1 && saturation === 1) return undefined;
  return `brightness(${1 + brightness}) contrast(${contrast}) saturate(${saturation})`;
}

const ASPECT = { "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1 } as const;

export type TimelinePreviewHandle = { seekTo: (seconds: number) => void };

/**
 * Preview da timeline: reproduz os clipes em sequência respeitando entrada e
 * saída, com legendas sobrepostas. A trilha de áudio de fundo e a mixagem final
 * só aparecem no arquivo exportado.
 */
export function TimelinePreview({
  timeline,
  assets,
  onTimeChange,
  ref,
}: {
  timeline: Timeline;
  assets: Map<string, MediaAsset>;
  onTimeChange: (seconds: number) => void;
  ref?: Ref<TimelinePreviewHandle>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [rawIndex, setIndex] = useState(0);
  const [sourceTime, setSourceTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const imageTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingSeek = useRef<number | null>(null);

  const clips = timeline.clips;
  // Mantém o índice válido quando clipes são removidos (estado derivado)
  const index = Math.max(0, Math.min(rawIndex, clips.length - 1));
  const clip = clips[index] as Clip | undefined;
  const asset = clip ? assets.get(clip.assetId) : undefined;
  const starts = clipStartTimes(timeline);
  const total = timelineDuration(timeline);
  const globalTime = clip ? starts[index] + Math.max(0, sourceTime - clip.in) : 0;
  const subtitle = timeline.subtitles.find((s) => globalTime >= s.start && globalTime < s.end);

  useEffect(() => {
    onTimeChange(globalTime);
  }, [globalTime, onTimeChange]);

  const goTo = useCallback(
    (seconds: number) => {
      const located = locateTime(timeline, seconds);
      if (!located) return;
      setIndex(located.clipIndex);
      setSourceTime(located.sourceSeconds);
      pendingSeek.current = located.sourceSeconds;
      const video = videoRef.current;
      if (video && timeline.clips[located.clipIndex]?.kind === "video" && located.clipIndex === index) {
        video.currentTime = located.sourceSeconds;
        pendingSeek.current = null;
      }
    },
    [timeline, index],
  );

  useImperativeHandle(ref, () => ({ seekTo: goTo }), [goTo]);

  const advance = useCallback(() => {
    if (index + 1 < clips.length) {
      const next = clips[index + 1];
      setIndex(index + 1);
      setSourceTime(next.in);
      pendingSeek.current = next.in;
    } else {
      setPlaying(false);
    }
  }, [index, clips]);

  // Imagens: avança por relógio
  useEffect(() => {
    if (imageTimer.current) clearInterval(imageTimer.current);
    if (!playing || clip?.kind !== "image") return;
    const startedAt = performance.now() - (sourceTime - clip.in) * 1000;
    imageTimer.current = setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      if (elapsed >= clipDuration(clip)) advance();
      else setSourceTime(clip.in + elapsed);
    }, 100);
    return () => {
      if (imageTimer.current) clearInterval(imageTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reinicia por clipe/estado de reprodução
  }, [playing, clip?.id, clip?.kind]);

  // Vídeos: sincroniza play/pause
  useEffect(() => {
    const video = videoRef.current;
    if (!video || clip?.kind !== "video") return;
    if (playing) void video.play().catch(() => setPlaying(false));
    else video.pause();
  }, [playing, clip?.id, clip?.kind]);

  if (!clip || !asset) {
    return (
      <div className="flex flex-col items-center gap-2 text-fg-subtle">
        <Video aria-hidden="true" className="size-8" />
        <span className="text-sm">Adicione clipes à timeline para visualizar</span>
      </div>
    );
  }

  return (
    <div className="flex size-full min-h-0 flex-col">
      {/* O quadro cabe no painel pela altura e pela largura (container query units) */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-3 [container-type:size]">
        <div
          className="relative overflow-hidden rounded-md bg-black"
          style={{
            aspectRatio: ASPECT[timeline.output.aspectRatio],
            width: `min(100cqw, 100cqh * ${ASPECT[timeline.output.aspectRatio]})`,
          }}
        >
          {clip.kind === "video" ? (
            <video
              key={clip.id}
              ref={videoRef}
              src={`/api/media/${asset.id}`}
              className="size-full object-contain"
              style={{ filter: cssFilter(clip) }}
              muted={clip.muted}
              playsInline
              preload="auto"
              onLoadedMetadata={(e) => {
                e.currentTarget.volume = Math.min(1, clip.volume);
                e.currentTarget.currentTime = pendingSeek.current ?? clip.in;
                pendingSeek.current = null;
                if (playing) void e.currentTarget.play().catch(() => setPlaying(false));
              }}
              onTimeUpdate={(e) => {
                const t = e.currentTarget.currentTime;
                if (t >= clip.out - 0.03) advance();
                else setSourceTime(t);
              }}
              onEnded={advance}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- mídia privada servida pela API
            <img src={`/api/media/${asset.id}`} alt="" className="size-full object-contain" style={{ filter: cssFilter(clip) }} />
          )}
          {subtitle ? (
            <p className="pointer-events-none absolute inset-x-4 bottom-[8%] text-center text-sm font-semibold text-white [text-shadow:0_1px_3px_#000,0_0_2px_#000] sm:text-base">
              {subtitle.text}
            </p>
          ) : null}
          {asset.isDemo ? (
            <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-warning">DEMONSTRAÇÃO</span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-center gap-1 border-t border-border p-2">
        <Button variant="ghost" size="icon" aria-label="Voltar ao início" onClick={() => goTo(0)}>
          <SkipBack />
        </Button>
        <Button variant="secondary" size="icon" aria-label={playing ? "Pausar" : "Reproduzir"} onClick={() => {
          if (!playing && globalTime >= total - 0.05) goTo(0);
          setPlaying((p) => !p);
        }}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <span className="ml-3 font-mono text-xs tabular-nums text-fg-muted">
          {formatTimecode(globalTime)} / {formatTimecode(total)}
        </span>
      </div>
    </div>
  );
}

/** Preview direto de uma mídia da biblioteca (controles nativos). */
export function AssetPreview({ asset }: { asset: MediaAsset }) {
  return (
    <div className="flex size-full items-center justify-center p-3">
      {asset.kind === "video" ? (
        <video key={asset.id} src={`/api/media/${asset.id}`} controls playsInline className="max-h-full w-full max-w-3xl rounded-md bg-black" />
      ) : asset.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- mídia privada servida pela API
        <img src={`/api/media/${asset.id}`} alt={asset.originalName} className="max-h-full max-w-full rounded-md object-contain" />
      ) : (
        <div className="w-full max-w-md space-y-3 text-center">
          <p className="text-sm text-fg">{asset.originalName}</p>
          <audio key={asset.id} src={`/api/media/${asset.id}`} controls className="w-full" />
        </div>
      )}
    </div>
  );
}
