import type { Metadata } from "next";
import { Images, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Biblioteca" };

export default function LibraryPage() {
  return (
    <>
      <PageHeader
        title="Biblioteca"
        description="Mídias enviadas e referências visuais: estilos, figurinos e personagens fictícios."
        actions={
          <Button disabled title="Disponível após a etapa 3">
            <Upload aria-hidden="true" />
            Enviar mídia
          </Button>
        }
      />
      <div className="p-4 sm:p-6">
        <div className="rounded-panel border border-border bg-surface">
          <EmptyState
            icon={Images}
            title="Nenhuma mídia ou referência"
            description="O upload validado e o registro de origem e permissões das referências serão implementados com o armazenamento privado."
            plannedStage={3}
          />
        </div>
      </div>
    </>
  );
}
