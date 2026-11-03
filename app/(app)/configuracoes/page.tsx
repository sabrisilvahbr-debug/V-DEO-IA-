import type { Metadata } from "next";
import { Cpu, Database, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsPage() {
  const supabaseReady = isSupabaseConfigured();

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Estado das integrações desta instalação."
      />
      <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-3">
        <Card>
          <Database aria-hidden="true" className="size-5 text-fg-muted" />
          <CardTitle className="mt-3 flex items-center justify-between gap-2">
            Supabase
            <Badge tone={supabaseReady ? "success" : "neutral"}>
              {supabaseReady ? "Variáveis definidas" : "Não configurado"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Banco de dados e autenticação. Defina as variáveis públicas em <code>.env.local</code>{" "}
            para habilitar na etapa 3.
          </CardDescription>
        </Card>
        <Card>
          <KeyRound aria-hidden="true" className="size-5 text-fg-muted" />
          <CardTitle className="mt-3 flex items-center justify-between gap-2">
            Conta
            <Badge tone="warning">Etapa 3</Badge>
          </CardTitle>
          <CardDescription>Perfil, sessão e exclusão de dados.</CardDescription>
        </Card>
        <Card>
          <Cpu aria-hidden="true" className="size-5 text-fg-muted" />
          <CardTitle className="mt-3 flex items-center justify-between gap-2">
            Provedores de IA
            <Badge tone="neutral">Nenhum conectado</Badge>
          </CardTitle>
          <CardDescription>
            Integrações serão adicionadas somente após verificação da documentação oficial.
          </CardDescription>
        </Card>
      </div>
    </>
  );
}
