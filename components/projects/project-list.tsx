import { FolderOpen } from "lucide-react";
import Link from "next/link";
import { AssetThumb } from "@/components/studio/asset-thumb";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/client/format";
import type { ProjectSummary } from "@/lib/domain/types";
import { ProjectActions } from "./project-actions";

export function ProjectList({ projects, search }: { projects: ProjectSummary[]; search?: string }) {
  if (projects.length === 0) {
    return (
      <div className="rounded-panel border border-border bg-surface">
        <EmptyState
          icon={FolderOpen}
          title={search ? "Nenhum projeto encontrado" : "Nenhum projeto ainda"}
          description={search ? `Nenhum projeto com "${search}" no nome.` : "Crie seu primeiro projeto acima para começar a enviar e editar vídeos."}
        />
      </div>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <li key={project.id} className="flex flex-col overflow-hidden rounded-panel border border-border bg-surface">
          <Link href={`/projetos/${project.id}`} className="group block">
            <AssetThumb
              asset={{ id: project.thumbnailAssetId ?? "", kind: "video", thumbnailKey: project.thumbnailAssetId ? "thumb" : null }}
              className="aspect-video w-full rounded-none transition-opacity group-hover:opacity-90"
            />
            <div className="px-4 pt-3">
              <p className="truncate font-medium text-fg group-hover:text-accent">{project.name}</p>
              <p className="mt-0.5 text-xs text-fg-subtle">
                {project.aspectRatio} · {project.assetCount} mídia(s) · {formatDateTime(project.updatedAt)}
              </p>
            </div>
          </Link>
          <div className="mt-auto px-3 pb-3 pt-2">
            <ProjectActions id={project.id} name={project.name} />
          </div>
        </li>
      ))}
    </ul>
  );
}
