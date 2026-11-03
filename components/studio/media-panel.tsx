"use client";

import { Eye, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/form-controls";
import { api, errorMessage } from "@/lib/client/api";
import { formatSeconds, mediaKindLabel, mediaRoleLabel } from "@/lib/client/format";
import type { MediaAsset } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { AssetThumb } from "./asset-thumb";
import { UploadBox } from "./upload-box";

type Filter = "all" | "video" | "image" | "audio" | "render";
const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "video", label: "Vídeos" },
  { id: "image", label: "Imagens" },
  { id: "audio", label: "Áudios" },
  { id: "render", label: "Exportações" },
];

export function MediaPanel({
  projectId,
  assets,
  maxUploadMb,
  uploadDisabledReason,
  previewAssetId,
  onUploaded,
  onDeleted,
  onPreview,
  onAddToTimeline,
  onUseAsMusic,
}: {
  projectId: string;
  assets: MediaAsset[];
  maxUploadMb: number;
  uploadDisabledReason: string | null;
  previewAssetId: string | null;
  onUploaded: (asset: MediaAsset) => void;
  onDeleted: (assetId: string) => void;
  onPreview: (asset: MediaAsset) => void;
  onAddToTimeline: (asset: MediaAsset) => void;
  onUseAsMusic: (asset: MediaAsset) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = assets.filter((a) =>
    filter === "all" ? a.role !== "render" : filter === "render" ? a.role === "render" : a.kind === filter && a.role !== "render",
  );

  async function remove(asset: MediaAsset) {
    setError(null);
    try {
      await api(`/api/media/${asset.id}`, { method: "DELETE" });
      onDeleted(asset.id);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div className="space-y-4 p-3">
      <UploadBox projectId={projectId} maxUploadMb={maxUploadMb} disabledReason={uploadDisabledReason} onUploaded={onUploaded} />

      <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar mídias">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
              filter === f.id ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-fg-subtle hover:text-fg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {visible.length === 0 ? (
        <p className="py-6 text-center text-xs text-fg-subtle">Nenhuma mídia neste filtro.</p>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((asset) => {
            const canAdd = asset.kind !== "audio" && asset.role !== "render";
            return (
              <li
                key={asset.id}
                className={cn(
                  "group rounded-md border p-1.5 transition-colors",
                  previewAssetId === asset.id ? "border-accent/50 bg-accent/5" : "border-transparent hover:border-border hover:bg-surface-raised",
                )}
              >
                <div className="flex gap-2">
                  <button type="button" onClick={() => onPreview(asset)} className="shrink-0 rounded" aria-label={`Visualizar ${asset.originalName}`}>
                    <AssetThumb asset={asset} className="h-12 w-20" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-fg" title={asset.originalName}>
                      {asset.originalName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-fg-subtle">
                      {mediaKindLabel[asset.kind]}
                      {asset.durationMs ? ` · ${formatSeconds(asset.durationMs / 1000)}` : ""}
                      {asset.width ? ` · ${asset.width}×${asset.height}` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {asset.role !== "source" ? <Badge className="px-1.5 py-0 text-[10px]">{mediaRoleLabel[asset.role]}</Badge> : null}
                      {asset.isDemo ? (
                        <Badge tone="warning" className="px-1.5 py-0 text-[10px]">
                          Demonstração
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {canAdd ? (
                    <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => onAddToTimeline(asset)}>
                      <Plus aria-hidden="true" />
                      Timeline
                    </Button>
                  ) : null}
                  {asset.kind === "audio" ? (
                    <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => onUseAsMusic(asset)}>
                      <Plus aria-hidden="true" />
                      Trilha
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onPreview(asset)}>
                    <Eye aria-hidden="true" />
                    Ver
                  </Button>
                  {confirmDelete === asset.id ? (
                    <>
                      <Button size="sm" variant="danger" className="h-7 px-2 text-xs" onClick={() => void remove(asset)}>
                        Confirmar exclusão
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmDelete(null)}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-7 px-2 text-xs"
                      aria-label={`Excluir ${asset.originalName}`}
                      onClick={() => setConfirmDelete(asset.id)}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
