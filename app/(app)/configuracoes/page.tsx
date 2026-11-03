import type { Metadata } from "next";
import { Cpu, Database, Film, Wallet } from "lucide-react";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/client/money";
import { serverConfig } from "@/lib/server/config";
import { startOfMonthIso } from "@/lib/server/costs";
import { ffmpegStatus } from "@/lib/server/media/ffmpeg";
import { requirePageContext } from "@/lib/server/page-context";
import { loadProviders } from "@/lib/server/studio-data";
import { plannedProviders } from "@/providers/registry";
import { generationModeLabel } from "@/providers/types";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Configurações" description="Estado desta instalação: dados, FFmpeg, provedores e custos." />
      <Suspense fallback={<div className="m-6 h-64 animate-pulse-soft rounded-panel border border-border bg-surface" aria-busy="true" />}>
        <SettingsData />
      </Suspense>
    </>
  );
}

async function SettingsData() {
  const ctx = await requirePageContext();
  const config = serverConfig();
  const [ffmpeg, providers, usage] = await Promise.all([
    ffmpegStatus(),
    loadProviders(),
    ctx.store.listUsage(ctx.user.id, { since: startOfMonthIso() }),
  ]);
  const spent = usage.reduce((t, e) => t + e.costCents, 0);

  return (
    <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-2">
      <Card>
        <Database aria-hidden="true" className="size-5 text-fg-muted" />
        <CardTitle className="mt-3 flex items-center justify-between gap-2">
          Dados e conta
          <Badge tone={config.backend === "local" ? "info" : "success"}>{config.backend === "local" ? "Modo local" : "Supabase"}</Badge>
        </CardTitle>
        <CardDescription>
          {config.backend === "local"
            ? "Projetos em SQLite e arquivos numa pasta privada deste computador. Sem login: um único usuário local."
            : `Conectado como ${ctx.user.email ?? ctx.user.id}. Dados no PostgreSQL com RLS e arquivos no Storage privado.`}
        </CardDescription>
        <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
          <dt className="text-fg-subtle">Upload máximo</dt>
          <dd className="text-fg">{Math.round(config.maxUploadBytes / 1024 / 1024)} MB</dd>
          <dt className="text-fg-subtle">Duração máxima</dt>
          <dd className="text-fg">{config.maxVideoSeconds} s</dd>
          <dt className="text-fg-subtle">Resolução máxima</dt>
          <dd className="text-fg">{config.maxResolution} px</dd>
        </dl>
        <a href="/diagnostico" className="mt-3 inline-block text-xs text-accent hover:underline">
          Abrir diagnóstico do ambiente
        </a>
      </Card>

      <Card>
        <Film aria-hidden="true" className="size-5 text-fg-muted" />
        <CardTitle className="mt-3 flex items-center justify-between gap-2">
          FFmpeg
          <Badge tone={ffmpeg.available && ffmpeg.probeAvailable ? "success" : "warning"}>
            {ffmpeg.available && ffmpeg.probeAvailable ? `Versão ${ffmpeg.version}` : "Não encontrado"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {ffmpeg.available ? "Usado para validar uploads, gerar miniaturas, detectar cenas e renderizar." : (ffmpeg.error ?? "Instale o FFmpeg e reinicie o servidor.")}
        </CardDescription>
        <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
          <li><Badge tone={ffmpeg.encoders.libx264 ? "success" : "warning"}>H.264</Badge></li>
          <li><Badge tone={ffmpeg.encoders.aac ? "success" : "warning"}>AAC</Badge></li>
          <li><Badge tone={ffmpeg.filters.subtitles ? "success" : "warning"}>Legendas no vídeo</Badge></li>
          <li><Badge tone={ffmpeg.filters.drawtext ? "success" : "neutral"}>Texto (drawtext)</Badge></li>
        </ul>
      </Card>

      <Card>
        <Cpu aria-hidden="true" className="size-5 text-fg-muted" />
        <CardTitle className="mt-3">Provedores de geração</CardTitle>
        <ul className="mt-3 space-y-3 text-xs">
          {providers.map((p) => (
            <li key={p.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-fg">{p.name}</span>
                <Badge tone={p.availability.available ? (p.isDemo ? "warning" : "success") : "neutral"}>
                  {p.availability.available ? (p.isDemo ? "Demonstração" : "Disponível") : "Indisponível"}
                </Badge>
              </div>
              <p className="text-fg-subtle">{p.notes}</p>
              <p className="text-fg-subtle">
                {p.capabilities.modes.map((m) => generationModeLabel[m]).join(" · ")} · {p.capabilities.minDurationSeconds}–{p.capabilities.maxDurationSeconds} s
              </p>
              {!p.availability.available ? <p className="text-warning">{p.availability.reason}</p> : null}
            </li>
          ))}
          {plannedProviders.map((p) => (
            <li key={p.name} className="flex items-center justify-between gap-2">
              <span className="text-fg-muted">{p.name}</span>
              <Badge>Etapa {p.stage}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <Wallet aria-hidden="true" className="size-5 text-fg-muted" />
        <CardTitle className="mt-3">Custos deste mês</CardTitle>
        <CardDescription>
          Não há créditos internos. Operações pagas em provedores externos exigem estimativa e confirmação, e respeitam o orçamento operacional.
        </CardDescription>
        <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs">
          <dt className="text-fg-subtle">Gasto registrado</dt>
          <dd className="font-mono text-fg">{formatCents(spent)}</dd>
          <dt className="text-fg-subtle">Orçamento operacional</dt>
          <dd className="font-mono text-fg">{config.operationalBudgetCents > 0 ? formatCents(config.operationalBudgetCents) : "Nenhum gasto pago permitido"}</dd>
          <dt className="text-fg-subtle">Operações registradas</dt>
          <dd className="text-fg">{usage.length}</dd>
        </dl>
      </Card>
    </div>
  );
}
