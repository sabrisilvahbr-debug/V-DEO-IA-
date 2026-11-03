import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProjectStudio } from "@/components/studio/project-studio";
import { StudioSkeleton } from "@/components/studio/studio-skeleton";
import { idSchema } from "@/lib/api/schemas";
import { toPublicJob } from "@/lib/server/jobs/public";
import { requirePageContext } from "@/lib/server/page-context";
import { loadProviders, loadSystem } from "@/lib/server/studio-data";

export const metadata: Metadata = { title: "Estúdio" };

export default function ProjectPage({ params }: PageProps<"/projetos/[id]">) {
  return (
    <Suspense fallback={<StudioSkeleton />}>
      <StudioLoader params={params} />
    </Suspense>
  );
}

async function StudioLoader({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePageContext();
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) notFound();
  const project = await ctx.store.getProject(ctx.user.id, parsed.data);
  if (!project) notFound();

  const [assets, versions, jobs, providers, system] = await Promise.all([
    ctx.store.listAssets(ctx.user.id, { projectId: project.id }),
    ctx.store.listVersions(ctx.user.id, project.id),
    ctx.store.listJobs(ctx.user.id, { projectId: project.id, limit: 30 }),
    loadProviders(),
    loadSystem(),
  ]);

  return (
    <ProjectStudio
      key={project.id}
      initial={{ project, assets, versions, jobs: jobs.map(toPublicJob), providers, system }}
    />
  );
}
