"use client";

import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Checkbox, NumberInput } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { buildSrt } from "@/lib/media/srt";
import { timelineDuration, type Timeline } from "@/lib/domain/timeline";
import type { TimelineAction } from "@/lib/domain/timeline-ops";

/** Edição manual de legendas, exportação SRT e opção de gravar no vídeo. */
export function SubtitlesEditor({
  timeline,
  playhead,
  subtitlesFilterAvailable,
  dispatch,
}: {
  timeline: Timeline;
  playhead: number;
  subtitlesFilterAvailable: boolean;
  dispatch: (action: TimelineAction) => void;
}) {
  const total = timelineDuration(timeline);

  function exportSrt() {
    const blob = new Blob([buildSrt(timeline.subtitles, total || Infinity)], { type: "application/x-subrip;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "legendas.srt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4 p-3">
      <Alert tone="info">
        Transcrição automática ainda não está configurada (nenhum serviço de transcrição conectado). Escreva as legendas manualmente.
      </Alert>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() =>
            dispatch({
              type: "addSubtitle",
              subtitle: { id: crypto.randomUUID(), start: Number(playhead.toFixed(2)), end: Number((playhead + 2).toFixed(2)), text: "Nova legenda" },
            })
          }
        >
          <Plus aria-hidden="true" />
          Adicionar no cursor
        </Button>
        <Button size="sm" variant="secondary" disabled={timeline.subtitles.length === 0} onClick={exportSrt}>
          <Download aria-hidden="true" />
          SRT
        </Button>
      </div>

      <Checkbox
        checked={timeline.output.burnSubtitles}
        disabled={!subtitlesFilterAvailable}
        onChange={(e) => dispatch({ type: "setOutput", patch: { burnSubtitles: e.target.checked } })}
        label={
          subtitlesFilterAvailable
            ? "Gravar as legendas no vídeo exportado"
            : "Gravar no vídeo indisponível: o FFmpeg instalado não tem o filtro de legendas (libass)."
        }
      />

      {timeline.subtitles.length === 0 ? (
        <p className="py-4 text-center text-xs text-fg-subtle">Nenhuma legenda.</p>
      ) : (
        <ul className="space-y-2">
          {timeline.subtitles.map((s, i) => (
            <li key={s.id} className="space-y-1.5 rounded-md border border-border bg-canvas p-2">
              <div className="flex items-center gap-1.5">
                <span className="w-5 text-[11px] text-fg-subtle">{i + 1}</span>
                <NumberInput aria-label={`Início da legenda ${i + 1}`} step={0.1} min={0} value={s.start} className="h-7 text-xs" onChange={(e) => dispatch({ type: "updateSubtitle", id: s.id, patch: { start: Number(e.target.value) } })} />
                <span className="text-fg-subtle">→</span>
                <NumberInput aria-label={`Fim da legenda ${i + 1}`} step={0.1} min={0} value={s.end} className="h-7 text-xs" onChange={(e) => dispatch({ type: "updateSubtitle", id: s.id, patch: { end: Number(e.target.value) } })} />
                <Button size="icon" variant="ghost" className="size-7 shrink-0" aria-label={`Remover legenda ${i + 1}`} onClick={() => dispatch({ type: "removeSubtitle", id: s.id })}>
                  <Trash2 />
                </Button>
              </div>
              <Input
                aria-label={`Texto da legenda ${i + 1}`}
                value={s.text}
                maxLength={300}
                className="h-8 text-xs"
                onChange={(e) => dispatch({ type: "updateSubtitle", id: s.id, patch: { text: e.target.value } })}
              />
              {!s.text.trim() ? <p className="text-[11px] text-danger">O texto não pode ficar vazio.</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
