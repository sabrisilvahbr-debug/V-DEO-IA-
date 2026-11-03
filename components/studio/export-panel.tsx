"use client";

import { Download, Film } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, Field, ProgressBar, Select, Slider } from "@/components/ui/form-controls";
import { api, errorMessage } from "@/lib/client/api";
import { formatBytes, formatDateTime, formatSeconds } from "@/lib/client/format";
import { QUALITY_PRESETS } from "@/lib/media/render-plan";
import { timelineDuration, type Timeline } from "@/lib/domain/timeline";
import type { TimelineAction } from "@/lib/domain/timeline-ops";
import type { AspectRatio, MediaAsset, ProjectVersion } from "@/lib/domain/types";
import type { PublicJob } from "./types";

/** Trilha de fundo, formato, qualidade, exportação e versões. */
export function ExportPanel({
  projectId,
  timeline,
  assets,
  versions,
  activeRender,
  ffmpegAvailable,
  dispatch,
  flush,
  onQueued,
}: {
  projectId: string;
  timeline: Timeline;
  assets: MediaAsset[];
  versions: ProjectVersion[];
  activeRender: PublicJob | null;
  ffmpegAvailable: boolean;
  dispatch: (action: TimelineAction) => void;
  flush: () => Promise<boolean>;
  onQueued: (job: PublicJob) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const audioAssets = assets.filter((a) => a.kind === "audio");
  const byId = new Map(assets.map((a) => [a.id, a]));
  const empty = timeline.clips.length === 0;

  async function render() {
    setError(null);
    setSubmitting(true);
    try {
      if (!(await flush())) throw new Error("Não foi possível salvar a timeline antes de exportar.");
      const { job } = await api<{ job: PublicJob }>("/api/renders", {
        method: "POST",
        json: { projectId, clientRequestId: crypto.randomUUID() },
      });
      onQueued(job);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 p-3">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Trilha de fundo</h3>
        <Field label="Áudio">
          {(id) => (
            <Select id={id} value={timeline.music?.assetId ?? ""} onChange={(e) => dispatch({ type: "setMusic", assetId: e.target.value || null })}>
              <option value="">Nenhuma</option>
              {audioAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.originalName}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {audioAssets.length === 0 ? <p className="text-[11px] text-fg-subtle">Envie um MP3, WAV ou M4A na aba Mídia.</p> : null}
        {timeline.music ? (
          <Slider
            label="Volume da trilha"
            min={0}
            max={1.5}
            step={0.05}
            value={timeline.music.volume}
            onValueChange={(v) => dispatch({ type: "setMusic", assetId: timeline.music!.assetId, volume: v })}
            format={(v) => `${Math.round(v * 100)}%`}
          />
        ) : null}
        <p className="text-[11px] text-fg-subtle">A trilha repete até o fim do vídeo e é mixada só na exportação.</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Formato</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Proporção">
            {(id) => (
              <Select id={id} value={timeline.output.aspectRatio} onChange={(e) => dispatch({ type: "setOutput", patch: { aspectRatio: e.target.value as AspectRatio } })}>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="1:1">1:1</option>
              </Select>
            )}
          </Field>
          <Field label="Qualidade">
            {(id) => (
              <Select id={id} value={timeline.output.quality} onChange={(e) => dispatch({ type: "setOutput", patch: { quality: e.target.value as Timeline["output"]["quality"] } })}>
                {(Object.keys(QUALITY_PRESETS) as Array<keyof typeof QUALITY_PRESETS>).map((q) => (
                  <option key={q} value={q}>
                    {QUALITY_PRESETS[q].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <p className="text-[11px] text-fg-subtle">16:9 horizontal, 9:16 vertical, 1:1 quadrado. Mídias de outra proporção recebem barras pretas (sem cortar a imagem). Saída MP4 H.264 + AAC.</p>
      </section>

      <section className="space-y-2">
        {!ffmpegAvailable ? <Alert tone="danger">FFmpeg indisponível no servidor: não é possível exportar.</Alert> : null}
        {activeRender ? (
          <div className="space-y-1.5 rounded-md border border-border bg-canvas p-2 text-xs">
            <p className="text-fg">{activeRender.status === "queued" ? "Na fila de exportação…" : "Renderizando…"}</p>
            <ProgressBar value={activeRender.progress} label="Progresso da exportação" />
          </div>
        ) : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button className="w-full" disabled={empty || submitting || Boolean(activeRender) || !ffmpegAvailable} onClick={() => void render()}>
          <Film aria-hidden="true" />
          {submitting ? "Enviando…" : `Exportar ${formatSeconds(timelineDuration(timeline))}`}
        </Button>
        {empty ? <p className="text-center text-[11px] text-fg-subtle">Adicione clipes à timeline para exportar.</p> : null}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Versões exportadas</h3>
        {versions.length === 0 ? (
          <p className="text-xs text-fg-subtle">Nenhuma exportação ainda.</p>
        ) : (
          <ul className="space-y-1.5">
            {versions.map((v) => {
              const asset = byId.get(v.renderAssetId);
              return (
                <li key={v.id} className="flex items-center gap-2 rounded-md border border-border bg-canvas p-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-fg">
                      Versão {v.number}{" "}
                      {asset?.isDemo ? (
                        <Badge tone="warning" className="ml-1 px-1.5 py-0 text-[10px]">
                          contém demonstração
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-fg-subtle">
                      {formatDateTime(v.createdAt)}
                      {asset ? ` · ${asset.width}×${asset.height} · ${formatBytes(asset.sizeBytes)}` : ""}
                    </p>
                  </div>
                  {asset ? (
                    <a
                      href={`/api/media/${asset.id}?download=1`}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-border-strong px-2 text-fg hover:bg-surface-overlay"
                    >
                      <Download aria-hidden="true" className="size-3.5" />
                      Baixar
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
