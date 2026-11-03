import type { Metadata } from "next";
import { Clock, FolderPlus, Loader, PlayCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { AssetThumb } from "@/components/studio/asset-thumb";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/form-controls";
import { Panel } from "@/components/ui/panel";
import { formatDateTime, jobStatusLabel, jobTypeLabel } from "@/lib/client/format";
import { requirePageContext } from "@/lib/server/page-context";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Projetos recentes, tarefas em andamento e resultados."
        actions={
          <ButtonLink href="/projetos">
            <FolderPlus aria-hidden="true" />
            Novo projeto
          </ButtonLink>
        }
      />
      <Suspense fallback={<div className="m-6 h-64 animate-pulse-soft rounded-panel border border-border bg-surface" aria-busy="true" />}>
        <DashboardData />
      </Suspense>
    </>
  );
}

async function DashboardData() {
  const ctx = await requirePageContext();
  const [projects, activeJobs, recentJobs, renders] = await Promise.all([
    ctx.store.listProjects(ctx.user.id, { limit: 6 }),
    ctx.store.listJobs(ctx.user.id, { statuses: ["queued", "running"], limit: 10 }),
    ctx.store.listJobs(ctx.user.id, { statuses: ["succeeded", "failed", "canceled"], limit: 8 }),
    ctx.store.listAssets(ctx.user.id, { role: "render", limit: 6 }),
  ]);
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));

  return (
    <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-3">
      <Panel title="Projetos recentes" className="lg:col-span-2">
        {projects.length === 0 ? (
          <EmptyState icon={FolderPlus} title="Nenhum projeto ainda" description="Crie um projeto para enviar vídeos, gerar cenas e exportar." action={<ButtonLink href="/projetos" size="sm">Criar projeto</ButtonLink>} />
        ) : (
          <ul className="divide-y divide-border">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projetos/${p.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-raised">
                  <AssetThumb asset={{ id: p.thumbnailAssetId ?? "", kind: "video", thumbnailKey: p.thumbnailAssetId ? "t" : null }} className="h-10 w-16 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{p.name}</p>
                    <p className="text-xs text-fg-subtle">
                      {p.aspectRatio} · {p.assetCount} mídia(s) · {formatDateTime(p.updatedAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Tarefas em andamento">
        {activeJobs.length === 0 ? (
          <EmptyState icon={Loader} title="Nenhuma tarefa ativa" description="Gerações, exportações e detecções de cena aparecem aqui." />
        ) : (
          <ul className="space-y-3 p-3">
            {activeJobs.map((job) => (
              <li key={job.id} className="space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-fg">{jobTypeLabel[job.type]}</span>
                  <span className="text-info">{jobStatusLabel[job.status]}</span>
                </div>
                <ProgressBar value={job.progress} label={jobTypeLabel[job.type]} />
                {job.projectId ? (
                  <Link href={`/projetos/${job.projectId}`} className="text-fg-subtle hover:text-fg">
                    {projectNames.get(job.projectId) ?? "Abrir projeto"}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Exportações recentes" className="lg:col-span-2">
        {renders.length === 0 ? (
          <EmptyState icon={PlayCircle} title="Nenhuma exportação" description="Vídeos finalizados no estúdio ficam disponíveis aqui para download." />
        ) : (
          <ul className="grid gap-3 p-3 sm:grid-cols-3">
            {renders.map((asset) => (
              <li key={asset.id} className="space-y-1.5">
                <AssetThumb asset={asset} className="aspect-video w-full" />
                <p className="truncate text-xs text-fg">{asset.originalName}</p>
                <a href={`/api/media/${asset.id}?download=1`} className="text-xs text-accent hover:underline">
                  Baixar
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Histórico">
        {recentJobs.length === 0 ? (
          <EmptyState icon={Clock} title="Sem histórico" description="Tarefas concluídas aparecerão aqui." />
        ) : (
          <ul className="divide-y divide-border text-xs">
            {recentJobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="text-fg">{jobTypeLabel[job.type]}</span>
                <span className={job.status === "succeeded" ? "text-success" : job.status === "failed" ? "text-danger" : "text-fg-subtle"}>
                  {jobStatusLabel[job.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
