import type { Metadata } from "next";
import { Suspense } from "react";
import { AssetLibrary } from "@/components/library/asset-library";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageContext } from "@/lib/server/page-context";
import { loadSystem } from "@/lib/server/studio-data";

export const metadata: Metadata = { title: "Biblioteca" };

export default function LibraryPage() {
  return (
    <>
      <PageHeader title="Biblioteca" description="Mídias enviadas, referências visuais, resultados gerados e exportações." />
      <div className="p-4 sm:p-6">
        <Suspense fallback={<div className="h-64 animate-pulse-soft rounded-panel border border-border bg-surface" aria-busy="true" />}>
          <LibraryData />
        </Suspense>
      </div>
    </>
  );
}

async function LibraryData() {
  const ctx = await requirePageContext();
  const [assets, projects, system] = await Promise.all([
    ctx.store.listAssets(ctx.user.id, { limit: 500 }),
    ctx.store.listProjects(ctx.user.id, { limit: 500 }),
    loadSystem(),
  ]);
  return (
    <AssetLibrary
      initialAssets={assets}
      projectNames={Object.fromEntries(projects.map((p) => [p.id, p.name]))}
      maxUploadMb={system.limits.maxUploadMb}
      uploadDisabledReason={system.ffmpeg.available && system.ffmpeg.probeAvailable ? null : "FFmpeg/FFprobe não encontrado no servidor."}
    />
  );
}
