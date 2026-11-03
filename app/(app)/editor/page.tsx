import type { Metadata } from "next";
import { Clapperboard } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { NewProjectForm } from "@/components/projects/new-project-form";
import { AssetThumb } from "@/components/studio/asset-thumb";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/client/format";
import { requirePageContext } from "@/lib/server/page-context";

export const metadata: Metadata = { title: "Editor" };

/** O editor trabalha sempre sobre um projeto: escolha um ou crie outro. */
export default function EditorPage() {
  return (
    <>
      <PageHeader title="Editor" description="Abra um projeto no estúdio ou crie um novo." />
      <div className="space-y-6 p-4 sm:p-6">
        <NewProjectForm />
        <Suspense fallback={<div className="h-40 animate-pulse-soft rounded-panel border border-border bg-surface" aria-busy="true" />}>
          <RecentProjects />
        </Suspense>
      </div>
    </>
  );
}

async function RecentProjects() {
  const ctx = await requirePageContext();
  const projects = await ctx.store.listProjects(ctx.user.id, { limit: 12 });
  if (projects.length === 0) {
    return (
      <div className="rounded-panel border border-border bg-surface">
        <EmptyState icon={Clapperboard} title="Nenhum projeto para abrir" description="Crie um projeto acima; o estúdio abre em seguida." />
      </div>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {projects.map((p) => (
        <li key={p.id}>
          <Link href={`/projetos/${p.id}`} className="group block overflow-hidden rounded-panel border border-border bg-surface hover:border-border-strong">
            <AssetThumb asset={{ id: p.thumbnailAssetId ?? "", kind: "video", thumbnailKey: p.thumbnailAssetId ? "t" : null }} className="aspect-video w-full rounded-none" />
            <div className="p-3">
              <p className="truncate text-sm font-medium text-fg group-hover:text-accent">{p.name}</p>
              <p className="text-xs text-fg-subtle">{formatDateTime(p.updatedAt)}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
