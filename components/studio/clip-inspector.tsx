"use client";

import { ScanSearch, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Checkbox, Field, NumberInput, Slider } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { api, errorMessage } from "@/lib/client/api";
import { formatSeconds } from "@/lib/client/format";
import { clipDuration, type Clip } from "@/lib/domain/timeline";
import type { TimelineAction } from "@/lib/domain/timeline-ops";
import type { MediaAsset } from "@/lib/domain/types";
import type { PublicJob } from "./types";

/** Propriedades do clipe: corte, áudio, cor e cortes inteligentes. */
export function ClipInspector({
  clip,
  asset,
  projectId,
  sceneJob,
  sourceTimeAtPlayhead,
  dispatch,
  onQueued,
}: {
  clip: Clip | null;
  asset: MediaAsset | null;
  projectId: string;
  sceneJob: PublicJob | null;
  sourceTimeAtPlayhead: number | null;
  dispatch: (action: TimelineAction) => void;
  onQueued: (job: PublicJob) => void;
}) {
  const [threshold, setThreshold] = useState(0.35);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!clip) {
    return (
      <EmptyState icon={SlidersHorizontal} title="Nenhum clipe selecionado" description="Selecione um clipe na timeline para ajustar corte, volume e cor." />
    );
  }

  const maxOut = asset?.kind === "video" && asset.durationMs ? asset.durationMs / 1000 : 600;
  const update = (patch: Extract<TimelineAction, { type: "updateClip" }>["patch"]) => dispatch({ type: "updateClip", clipId: clip.id, patch });
  const scenes = sceneJob?.status === "succeeded" && sceneJob.output?.assetId === clip.assetId
    ? ((sceneJob.output.segments as Array<{ in: number; out: number }>) ?? []).filter((s) => s.out > clip.in && s.in < clip.out)
    : [];

  async function detectScenes() {
    if (!asset) return;
    setDetecting(true);
    setError(null);
    try {
      const { job } = await api<{ job: PublicJob }>("/api/scene-detections", {
        method: "POST",
        json: { projectId, assetId: asset.id, threshold, clientRequestId: crypto.randomUUID() },
      });
      onQueued(job);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setDetecting(false);
    }
  }

  return (
    <div className="space-y-5 p-3">
      <div>
        <p className="truncate text-sm font-medium text-fg">{asset?.originalName ?? "Mídia ausente"}</p>
        <p className="text-xs text-fg-subtle">Duração no projeto: {formatSeconds(clipDuration(clip))}</p>
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Corte</h3>
        {clip.kind === "video" ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Entrada (s)">
              {(id) => (
                <NumberInput id={id} step={0.1} min={0} max={clip.out - 0.1} value={clip.in} onChange={(e) => update({ in: Number(e.target.value) })} />
              )}
            </Field>
            <Field label="Saída (s)">
              {(id) => (
                <NumberInput id={id} step={0.1} min={clip.in + 0.1} max={maxOut} value={clip.out} onChange={(e) => update({ out: Math.min(maxOut, Number(e.target.value)) })} />
              )}
            </Field>
            {sourceTimeAtPlayhead !== null ? (
              <>
                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => update({ in: Math.min(sourceTimeAtPlayhead, clip.out - 0.1) })}>
                  Entrada aqui
                </Button>
                <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => update({ out: Math.max(sourceTimeAtPlayhead, clip.in + 0.1) })}>
                  Saída aqui
                </Button>
              </>
            ) : null}
          </div>
        ) : (
          <Field label="Duração da imagem (s)">
            {(id) => <NumberInput id={id} step={0.5} min={0.5} max={60} value={clip.out} onChange={(e) => update({ in: 0, out: Math.min(60, Number(e.target.value)) })} />}
          </Field>
        )}
      </section>

      {clip.kind === "video" ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Áudio do clipe</h3>
          {asset && !asset.hasAudio ? <p className="text-xs text-fg-subtle">Este vídeo não tem faixa de áudio.</p> : null}
          <Slider label="Volume" min={0} max={2} step={0.05} value={clip.volume} disabled={clip.muted || !asset?.hasAudio} onValueChange={(v) => update({ volume: v })} format={(v) => `${Math.round(v * 100)}%`} />
          <Checkbox label="Sem som" checked={clip.muted} disabled={!asset?.hasAudio} onChange={(e) => update({ muted: e.target.checked })} />
        </section>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Cor</h3>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => update({ color: { brightness: 0, contrast: 1, saturation: 1 } })}>
            Redefinir
          </Button>
        </div>
        <Slider label="Brilho" min={-0.5} max={0.5} step={0.01} value={clip.color.brightness} onValueChange={(v) => update({ color: { brightness: v } })} format={(v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2))} />
        <Slider label="Contraste" min={0.5} max={1.8} step={0.01} value={clip.color.contrast} onValueChange={(v) => update({ color: { contrast: v } })} format={(v) => v.toFixed(2)} />
        <Slider label="Saturação" min={0} max={2.5} step={0.01} value={clip.color.saturation} onValueChange={(v) => update({ color: { saturation: v } })} format={(v) => v.toFixed(2)} />
        <p className="text-[11px] text-fg-subtle">O preview usa uma aproximação; o arquivo exportado aplica a correção do FFmpeg.</p>
      </section>

      {clip.kind === "video" ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Cortes inteligentes</h3>
          <Slider
            label="Sensibilidade"
            min={0.15}
            max={0.7}
            step={0.05}
            value={threshold}
            onValueChange={setThreshold}
            format={(v) => (v < 0.3 ? "alta" : v < 0.5 ? "média" : "baixa")}
          />
          <Button size="sm" variant="secondary" className="w-full" onClick={() => void detectScenes()} disabled={detecting || sceneJob?.status === "running" || sceneJob?.status === "queued"}>
            <ScanSearch aria-hidden="true" />
            {sceneJob && (sceneJob.status === "running" || sceneJob.status === "queued") ? "Detectando cenas…" : "Detectar mudanças de cena"}
          </Button>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {scenes.length > 1 ? (
            <div className="space-y-2 rounded-md border border-border bg-canvas p-2 text-xs">
              <p className="text-fg-muted">{scenes.length} segmentos sugeridos dentro deste clipe:</p>
              <ul className="max-h-28 space-y-0.5 overflow-auto font-mono text-[11px] text-fg-subtle">
                {scenes.map((s) => (
                  <li key={`${s.in}-${s.out}`}>
                    {s.in.toFixed(2)} s → {s.out.toFixed(2)} s
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                className="w-full"
                onClick={() =>
                  dispatch({
                    type: "applySegments",
                    clipId: clip.id,
                    segments: scenes.map((s) => ({ in: Math.max(s.in, clip.in), out: Math.min(s.out, clip.out) })),
                    newIds: scenes.map(() => crypto.randomUUID()),
                  })
                }
              >
                Dividir o clipe nesses cortes
              </Button>
            </div>
          ) : sceneJob?.status === "succeeded" && sceneJob.output?.assetId === clip.assetId ? (
            <p className="text-xs text-fg-subtle">Nenhuma mudança de cena encontrada neste trecho.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
