"use client";

import { Download, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AssetThumb } from "@/components/studio/asset-thumb";
import { UploadBox } from "@/components/studio/upload-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/form-controls";
import { api, errorMessage } from "@/lib/client/api";
import { formatBytes, formatSeconds, mediaKindLabel, mediaRoleLabel } from "@/lib/client/format";
import type { MediaAsset, MediaRole } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type Filter = "all" | MediaRole;

/** Biblioteca de mídias e referências visuais, com origem e direitos declarados. */
export function AssetLibrary({
  initialAssets,
  projectNames,
  maxUploadMb,
  uploadDisabledReason,
}: {
  initialAssets: MediaAsset[];
  projectNames: Record<string, string>;
  maxUploadMb: number;
  uploadDisabledReason: string | null;
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [filter, setFilter] = useState<Filter>("all");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const visible = filter === "all" ? assets : assets.filter((a) => a.role === filter);

  async function remove(id: string) {
    setError(null);
    try {
      await api(`/api/media/${id}`, { method: "DELETE" });
      setAssets((a) => a.filter((x) => x.id !== id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setConfirm(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-3 rounded-panel border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Adicionar referência</h2>
        <p className="text-xs text-fg-subtle">
          Imagens de estilo, figurino ou personagens fictícios. Informe a origem e confirme que você pode usá-las.
        </p>
        <UploadBox
          projectId={null}
          role="reference"
          maxUploadMb={maxUploadMb}
          disabledReason={uploadDisabledReason}
          onUploaded={(asset) => setAssets((a) => [asset, ...a])}
        />
      </aside>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por tipo">
          {(["all", "source", "reference", "generated", "render"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                filter === f ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-fg-subtle hover:text-fg-muted",
              )}
            >
              {f === "all" ? "Tudo" : mediaRoleLabel[f]}
            </button>
          ))}
        </div>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {visible.length === 0 ? (
          <p className="rounded-panel border border-border bg-surface py-12 text-center text-sm text-fg-subtle">Nenhuma mídia neste filtro.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((asset) => (
              <li key={asset.id} className="flex flex-col overflow-hidden rounded-panel border border-border bg-surface">
                <AssetThumb asset={asset} className="aspect-video w-full rounded-none" />
                <div className="flex flex-1 flex-col gap-1.5 p-3 text-xs">
                  <p className="truncate text-sm font-medium text-fg" title={asset.originalName}>
                    {asset.originalName}
                  </p>
                  <p className="text-fg-subtle">
                    {mediaKindLabel[asset.kind]} · {formatBytes(asset.sizeBytes)}
                    {asset.durationMs ? ` · ${formatSeconds(asset.durationMs / 1000)}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Badge className="px-1.5 py-0 text-[10px]">{mediaRoleLabel[asset.role]}</Badge>
                    {asset.isDemo ? <Badge tone="warning" className="px-1.5 py-0 text-[10px]">Demonstração</Badge> : null}
                    {asset.rightsConfirmed ? <Badge tone="success" className="px-1.5 py-0 text-[10px]">Direitos declarados</Badge> : null}
                  </div>
                  {asset.origin ? <p className="text-fg-subtle">Origem: {asset.origin}</p> : null}
                  {asset.projectId && projectNames[asset.projectId] ? (
                    <Link href={`/projetos/${asset.projectId}`} className="text-fg-muted hover:text-accent">
                      Projeto: {projectNames[asset.projectId]}
                    </Link>
                  ) : null}
                  <div className="mt-auto flex items-center gap-1 pt-1">
                    <a href={`/api/media/${asset.id}?download=1`} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-fg-muted hover:bg-surface-raised hover:text-fg">
                      <Download aria-hidden="true" className="size-3.5" />
                      Baixar
                    </a>
                    {confirm === asset.id ? (
                      <>
                        <Button size="sm" variant="danger" className="ml-auto h-7 px-2 text-xs" onClick={() => void remove(asset.id)}>
                          Confirmar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirm(null)}>
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" aria-label={`Excluir ${asset.originalName}`} onClick={() => setConfirm(asset.id)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
