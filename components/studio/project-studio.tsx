"use client";

import { Check, CloudOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Alert, Tabs } from "@/components/ui/form-controls";
import { Panel } from "@/components/ui/panel";
import { api } from "@/lib/client/api";
import { clipStartTimes, type Timeline } from "@/lib/domain/timeline";
import { timelineReducer, type TimelineAction } from "@/lib/domain/timeline-ops";
import type { MediaAsset, ProjectVersion } from "@/lib/domain/types";
import { ClipInspector } from "./clip-inspector";
import { ExportPanel } from "./export-panel";
import { GeneratePanel } from "./generate-panel";
import { JobsPanel } from "./jobs-panel";
import { MediaPanel } from "./media-panel";
import { AssetPreview, TimelinePreview, type TimelinePreviewHandle } from "./preview-player";
import { SubtitlesEditor } from "./subtitles-editor";
import { TimelineEditor } from "./timeline-editor";
import type { PublicJob, StudioInitialData } from "./types";
import { useAutosave } from "./use-autosave";
import { useProjectJobs } from "./use-project-jobs";

type LeftTab = "media" | "generate" | "jobs";
type RightTab = "clip" | "subtitles" | "export";

/** Legendas vazias (em edição) não são salvas, para não invalidar a timeline. */
function sanitize(timeline: Timeline): Timeline {
  return { ...timeline, subtitles: timeline.subtitles.filter((s) => s.text.trim()) };
}

export function ProjectStudio({ initial }: { initial: StudioInitialData }) {
  const projectId = initial.project.id;
  const [timeline, dispatch] = useReducer(timelineReducer, initial.project.timeline);
  const [assets, setAssets] = useState<MediaAsset[]>(initial.assets);
  const [versions, setVersions] = useState<ProjectVersion[]>(initial.versions);
  const [leftTab, setLeftTab] = useState<LeftTab>("media");
  const [rightTab, setRightTab] = useState<RightTab>("clip");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const previewRef = useRef<TimelinePreviewHandle>(null);
  const [zoom, setZoom] = useState(40);

  const sanitized = useMemo(() => sanitize(timeline), [timeline]);
  const { state: saveState, flush } = useAutosave(projectId, sanitized);
  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const reloadProject = useCallback(async () => {
    const data = await api<{ assets: MediaAsset[]; versions: ProjectVersion[] }>(`/api/projects/${projectId}`);
    setAssets(data.assets);
    setVersions(data.versions);
  }, [projectId]);

  const onJobFinished = useCallback(
    (job: PublicJob) => {
      if (job.status === "succeeded" && (job.type === "generation" || job.type === "render")) void reloadProject();
    },
    [reloadProject],
  );
  const { jobs, track, pollError } = useProjectJobs(projectId, initial.jobs, onJobFinished);

  const now = useNow(5000);
  const workerHint = jobs.some((j) => j.status === "queued" && now - new Date(j.createdAt).getTime() > 15_000 && j.attempts === 0);
  const activeCount = jobs.filter((j) => j.status === "queued" || j.status === "running").length;
  const activeRender = jobs.find((j) => j.type === "render" && (j.status === "queued" || j.status === "running")) ?? null;

  const selectedIndex = timeline.clips.findIndex((c) => c.id === selectedClipId);
  const selectedClip = selectedIndex >= 0 ? timeline.clips[selectedIndex] : null;
  const selectedAsset = selectedClip ? (assetMap.get(selectedClip.assetId) ?? null) : null;
  const sceneJob = selectedClip ? (jobs.find((j) => j.type === "scene_detect" && j.input.assetId === selectedClip.assetId) ?? null) : null;

  const starts = clipStartTimes(timeline);
  const sourceTimeAtPlayhead =
    selectedClip && selectedIndex >= 0 && playhead >= starts[selectedIndex] && playhead <= starts[selectedIndex] + (selectedClip.out - selectedClip.in)
      ? selectedClip.in + (playhead - starts[selectedIndex])
      : null;

  const act = useCallback((action: TimelineAction) => dispatch(action), []);
  const seekTo = useCallback((time: number) => {
    setPreviewAssetId(null);
    previewRef.current?.seekTo(time);
  }, []);

  const previewAsset = previewAssetId ? assetMap.get(previewAssetId) : undefined;
  const uploadDisabled = !initial.system.ffmpeg.available || !initial.system.ffmpeg.probeAvailable
    ? "O FFmpeg/FFprobe não foi encontrado no servidor. Instale o FFmpeg para enviar mídias."
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2">
        <Link href="/projetos" className="text-xs text-fg-subtle hover:text-fg">
          Projetos
        </Link>
        <span className="text-fg-subtle">/</span>
        <h1 className="truncate text-sm font-semibold text-fg">{initial.project.name}</h1>
        <SaveIndicator status={saveState.status} />
        {saveState.error ? <span className="text-xs text-danger">{saveState.error}</span> : null}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[19rem_minmax(0,1fr)_19rem] lg:grid-rows-[minmax(0,1fr)_15rem]">
        <section className="flex min-h-[24rem] flex-col overflow-hidden rounded-panel border border-border bg-surface lg:min-h-0">
          <Tabs<LeftTab>
            label="Painel de mídia"
            value={leftTab}
            onChange={setLeftTab}
            tabs={[
              { id: "media", label: "Mídia" },
              { id: "generate", label: "Gerar" },
              { id: "jobs", label: "Tarefas", badge: activeCount ? <Badge tone="info" className="px-1.5 py-0 text-[10px]">{activeCount}</Badge> : null },
            ]}
          />
          <div className="min-h-0 flex-1 overflow-auto" role="tabpanel">
            {leftTab === "media" ? (
              <MediaPanel
                projectId={projectId}
                assets={assets}
                maxUploadMb={initial.system.limits.maxUploadMb}
                uploadDisabledReason={uploadDisabled}
                previewAssetId={previewAssetId}
                onUploaded={(asset) => setAssets((a) => [asset, ...a])}
                onDeleted={(id) => {
                  setAssets((a) => a.filter((x) => x.id !== id));
                  if (previewAssetId === id) setPreviewAssetId(null);
                }}
                onPreview={(asset) => setPreviewAssetId(asset.id)}
                onAddToTimeline={(asset) => {
                  const id = crypto.randomUUID();
                  dispatch({ type: "addClip", asset, id });
                  setSelectedClipId(id);
                  setPreviewAssetId(null);
                  setRightTab("clip");
                }}
                onUseAsMusic={(asset) => {
                  dispatch({ type: "setMusic", assetId: asset.id });
                  setRightTab("export");
                }}
              />
            ) : leftTab === "generate" ? (
              <GeneratePanel
                projectId={projectId}
                defaultAspectRatio={timeline.output.aspectRatio}
                providers={initial.providers}
                assets={assets}
                onQueued={(job) => {
                  track(job);
                  setLeftTab("jobs");
                }}
              />
            ) : (
              <JobsPanel jobs={jobs} pollError={pollError} workerHint={workerHint} onChanged={track} />
            )}
          </div>
        </section>

        <Panel
          title={previewAsset ? `Preview · ${previewAsset.originalName}` : "Preview da timeline"}
          bodyClassName="flex flex-col"
          className="min-h-[22rem] lg:min-h-0"
          actions={
            previewAsset ? (
              <button type="button" className="text-xs text-accent hover:underline" onClick={() => setPreviewAssetId(null)}>
                Voltar à timeline
              </button>
            ) : null
          }
        >
          {previewAsset ? (
            <AssetPreview asset={previewAsset} />
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <TimelinePreview ref={previewRef} timeline={timeline} assets={assetMap} onTimeChange={setPlayhead} />
            </div>
          )}
        </Panel>

        <section className="flex min-h-[24rem] flex-col overflow-hidden rounded-panel border border-border bg-surface lg:min-h-0">
          <Tabs<RightTab>
            label="Inspetor"
            value={rightTab}
            onChange={setRightTab}
            tabs={[
              { id: "clip", label: "Clipe" },
              { id: "subtitles", label: "Legendas" },
              { id: "export", label: "Exportar" },
            ]}
          />
          <div className="min-h-0 flex-1 overflow-auto" role="tabpanel">
            {rightTab === "clip" ? (
              <ClipInspector
                clip={selectedClip}
                asset={selectedAsset}
                projectId={projectId}
                sceneJob={sceneJob}
                sourceTimeAtPlayhead={sourceTimeAtPlayhead}
                dispatch={act}
                onQueued={track}
              />
            ) : rightTab === "subtitles" ? (
              <SubtitlesEditor timeline={timeline} playhead={playhead} subtitlesFilterAvailable={initial.system.ffmpeg.filters.subtitles} dispatch={act} />
            ) : (
              <ExportPanel
                projectId={projectId}
                timeline={timeline}
                assets={assets}
                versions={versions}
                activeRender={activeRender}
                ffmpegAvailable={initial.system.ffmpeg.available}
                dispatch={act}
                flush={flush}
                onQueued={(job) => track(job)}
              />
            )}
          </div>
        </section>

        <section className="min-h-[14rem] overflow-hidden rounded-panel border border-border bg-surface lg:col-span-3 lg:min-h-0" aria-label="Timeline">
          <TimelineEditor
            timeline={timeline}
            assets={assetMap}
            selectedClipId={selectedClipId}
            playhead={playhead}
            zoom={zoom}
            onZoom={setZoom}
            onSelect={(id) => {
              setSelectedClipId(id);
              if (id) {
                setRightTab("clip");
                const index = timeline.clips.findIndex((c) => c.id === id);
                if (index >= 0) seekTo(starts[index]);
              }
            }}
            onSeek={seekTo}
            onMove={(direction) => selectedClipId && dispatch({ type: "moveClip", clipId: selectedClipId, direction })}
            onSplit={() => {
              if (!selectedClip || sourceTimeAtPlayhead === null) return;
              dispatch({ type: "splitClip", clipId: selectedClip.id, atSourceSeconds: sourceTimeAtPlayhead, newId: crypto.randomUUID() });
            }}
            onDuplicate={() => selectedClipId && dispatch({ type: "duplicateClip", clipId: selectedClipId, newId: crypto.randomUUID() })}
            onRemove={() => {
              if (!selectedClipId) return;
              dispatch({ type: "removeClip", clipId: selectedClipId });
              setSelectedClipId(null);
            }}
          />
        </section>
      </div>
      {initial.providers.some((p) => p.isDemo && p.availability.available) ? (
        <Alert tone="warning" className="mx-3 mb-3">
          Modo de demonstração ativo: o provedor MOCK não usa IA. Vídeos gerados por ele são padrões de teste ou filtros simples, marcados como &quot;Demonstração&quot;.
        </Alert>
      ) : null}
    </div>
  );
}

function SaveIndicator({ status }: { status: "saved" | "pending" | "saving" | "error" }) {
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-xs text-danger">
        <CloudOff aria-hidden="true" className="size-3.5" /> Não salvo
      </span>
    );
  }
  if (status === "saving" || status === "pending") {
    return (
      <span className="flex items-center gap-1 text-xs text-fg-subtle" aria-live="polite">
        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> Salvando…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-fg-subtle" aria-live="polite">
      <Check aria-hidden="true" className="size-3.5 text-success" /> Salvo
    </span>
  );
}

/** Relógio que atualiza periodicamente (evita Date.now() durante o render). */
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
