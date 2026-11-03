import type { Metadata } from "next";
import { Clock, FolderPlus, Loader, PlayCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Projetos recentes, tarefas em andamento e resultados."
        actions={
          <>
            <ButtonLink href="/editor" variant="secondary">
              Abrir editor
            </ButtonLink>
            <Button disabled title="Disponível após a etapa 3">
              <FolderPlus aria-hidden="true" />
              Novo projeto
            </Button>
          </>
        }
      />
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-3">
        <Panel title="Projetos recentes" className="lg:col-span-2">
          <EmptyState
            icon={FolderPlus}
            title="Nenhum projeto ainda"
            description="A criação e o armazenamento de projetos dependem do banco de dados."
            plannedStage={3}
          />
        </Panel>
        <Panel title="Tarefas em andamento">
          <EmptyState
            icon={Loader}
            title="Nenhuma tarefa"
            description="Gerações e renderizações aparecerão aqui com o status de processamento."
            plannedStage={4}
          />
        </Panel>
        <Panel title="Resultados disponíveis" className="lg:col-span-2">
          <EmptyState
            icon={PlayCircle}
            title="Nenhum resultado"
            description="Vídeos finalizados ficarão disponíveis para preview e exportação."
            plannedStage={5}
          />
        </Panel>
        <Panel title="Histórico">
          <EmptyState
            icon={Clock}
            title="Sem histórico"
            description="O registro de versões e execuções será exibido aqui."
            plannedStage={3}
          />
        </Panel>
      </div>
    </>
  );
}
