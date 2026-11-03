import type { Metadata } from "next";
import { FolderOpen, FolderPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Projetos" };

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projetos"
        description="Pesquise, organize, duplique e exclua seus projetos."
        actions={
          <Button disabled title="Disponível após a etapa 3">
            <FolderPlus aria-hidden="true" />
            Novo projeto
          </Button>
        }
      />
      <div className="p-4 sm:p-6">
        <div className="rounded-panel border border-border bg-surface">
          <EmptyState
            icon={FolderOpen}
            title="Biblioteca de projetos vazia"
            description="Seus projetos, versões e parâmetros ficarão guardados aqui quando o banco de dados estiver conectado."
            plannedStage={3}
          />
        </div>
      </div>
    </>
  );
}
