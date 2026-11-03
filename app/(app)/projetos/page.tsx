import type { Metadata } from "next";
import { Search } from "lucide-react";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { NewProjectForm } from "@/components/projects/new-project-form";
import { ProjectList } from "@/components/projects/project-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requirePageContext } from "@/lib/server/page-context";

export const metadata: Metadata = { title: "Projetos" };

export default function ProjectsPage({ searchParams }: PageProps<"/projetos">) {
  return (
    <>
      <PageHeader title="Projetos" description="Crie, pesquise, renomeie, duplique e exclua seus projetos." />
      <div className="space-y-6 p-4 sm:p-6">
        <NewProjectForm />
        <Suspense fallback={<ListSkeleton />}>
          <ProjectsLoader searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function ProjectsLoader({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requirePageContext();
  const raw = (await searchParams).q;
  const search = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 120) || undefined;
  const projects = await ctx.store.listProjects(ctx.user.id, { search });
  return (
    <div className="space-y-4">
      <form className="flex max-w-md gap-2" role="search">
        <Input name="q" defaultValue={search} placeholder="Pesquisar por nome" aria-label="Pesquisar projetos" className="h-9" />
        <Button type="submit" variant="secondary" size="sm" className="h-9">
          <Search aria-hidden="true" />
          Buscar
        </Button>
      </form>
      <ProjectList projects={projects} search={search} />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando projetos">
      {[0, 1, 2].map((i) => (
        <div key={i} className="aspect-[4/3] animate-pulse-soft rounded-panel border border-border bg-surface" />
      ))}
    </div>
  );
}
