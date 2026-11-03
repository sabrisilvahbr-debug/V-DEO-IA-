import {
  AudioLines,
  Captions,
  Film,
  ImagePlus,
  Play,
  SlidersHorizontal,
  SkipBack,
  SkipForward,
  Upload,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";

const tracks = [
  { id: "v1", label: "Vídeo 1", icon: Film },
  { id: "a1", label: "Áudio 1", icon: AudioLines },
  { id: "s1", label: "Legendas", icon: Captions },
];

const rulerMarks = ["00:00", "00:05", "00:10", "00:15", "00:20", "00:25", "00:30"];

/**
 * Layout do estúdio: mídia | preview | inspetor, com timeline embaixo.
 * Todos os controles estão desabilitados e identificados até que os módulos
 * de upload (etapa 3), timeline (etapa 5) e geração (etapa 6) existam.
 */
export function StudioWorkspace() {
  return (
    <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[16rem_minmax(0,1fr)_17rem] lg:grid-rows-[minmax(0,1fr)_14rem]">
      <Panel
        title="Mídia"
        className="lg:row-span-1"
        actions={
          <Button variant="ghost" size="icon" disabled aria-label="Enviar mídia (indisponível)">
            <Upload />
          </Button>
        }
      >
        <EmptyState
          icon={ImagePlus}
          title="Nenhuma mídia"
          description="O upload de vídeos, imagens e áudios será habilitado com o armazenamento."
          plannedStage={3}
        />
      </Panel>

      <Panel title="Preview" bodyClassName="flex flex-col">
        <div className="flex flex-1 items-center justify-center p-3">
          <div
            className="flex aspect-video w-full max-w-3xl items-center justify-center rounded-md border border-dashed border-border-strong bg-canvas"
            aria-label="Área de preview vazia"
            role="img"
          >
            <div className="flex flex-col items-center gap-2 text-fg-subtle">
              <Video aria-hidden="true" className="size-8" />
              <span className="text-sm">Nenhum vídeo carregado</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1 border-t border-border p-2">
          <Button variant="ghost" size="icon" disabled aria-label="Voltar ao início">
            <SkipBack />
          </Button>
          <Button variant="secondary" size="icon" disabled aria-label="Reproduzir">
            <Play />
          </Button>
          <Button variant="ghost" size="icon" disabled aria-label="Avançar ao fim">
            <SkipForward />
          </Button>
          <span className="ml-3 font-mono text-xs tabular-nums text-fg-subtle">
            00:00:00 / 00:00:00
          </span>
        </div>
      </Panel>

      <Panel title="Inspetor">
        <EmptyState
          icon={SlidersHorizontal}
          title="Nada selecionado"
          description="Propriedades de clipes, cor, áudio e prompts aparecerão aqui."
          plannedStage={5}
        />
      </Panel>

      <Panel title="Timeline" className="lg:col-span-3">
        <div className="min-w-[36rem]">
          <div className="ml-28 flex justify-between border-b border-border px-2 py-1 font-mono text-[10px] text-fg-subtle">
            {rulerMarks.map((mark) => (
              <span key={mark}>{mark}</span>
            ))}
          </div>
          <ul aria-label="Faixas da timeline">
            {tracks.map(({ id, label, icon: Icon }) => (
              <li key={id} className="flex h-11 items-stretch border-b border-border/70">
                <div className="flex w-28 shrink-0 items-center gap-2 border-r border-border px-3 text-xs text-fg-muted">
                  <Icon aria-hidden="true" className="size-3.5" />
                  {label}
                </div>
                <div className="flex flex-1 items-center px-3 text-xs text-fg-subtle">
                  Faixa vazia
                </div>
              </li>
            ))}
          </ul>
          <p className="px-3 py-2 text-xs text-fg-subtle">
            Edição de timeline em desenvolvimento · Etapa 5
          </p>
        </div>
      </Panel>
    </div>
  );
}

