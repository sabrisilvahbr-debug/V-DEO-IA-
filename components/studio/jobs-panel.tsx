"use client";

import { CheckCircle2, CircleX, Clock, Loader2, Ban } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, ProgressBar } from "@/components/ui/form-controls";
import { api, errorMessage } from "@/lib/client/api";
import { formatDateTime, jobStatusLabel, jobTypeLabel } from "@/lib/client/format";
import type { PublicJob } from "./types";

const statusIcon = {
  queued: Clock,
  running: Loader2,
  succeeded: CheckCircle2,
  failed: CircleX,
  canceled: Ban,
} as const;

const statusColor = {
  queued: "text-fg-subtle",
  running: "text-info",
  succeeded: "text-success",
  failed: "text-danger",
  canceled: "text-fg-subtle",
} as const;

export function JobsPanel({
  jobs,
  pollError,
  workerHint,
  onChanged,
}: {
  jobs: PublicJob[];
  pollError: boolean;
  workerHint: boolean;
  onChanged: (job: PublicJob) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function cancel(job: PublicJob) {
    setError(null);
    try {
      const { job: updated } = await api<{ job: PublicJob }>(`/api/jobs/${job.id}/cancel`, { method: "POST" });
      if (updated) onChanged(updated);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="space-y-3 p-3">
      {pollError ? <Alert tone="warning">Não foi possível atualizar o status. Tentando novamente…</Alert> : null}
      {workerHint ? (
        <Alert tone="info">
          Há tarefas na fila há mais de 15 s. Verifique se o worker está rodando (<code>npm run worker</code> ou <code>npm run dev:all</code>).
        </Alert>
      ) : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {jobs.length === 0 ? (
        <p className="py-6 text-center text-xs text-fg-subtle">Nenhuma tarefa neste projeto.</p>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => {
            const Icon = statusIcon[job.status];
            const active = job.status === "queued" || job.status === "running";
            const warnings = (job.output?.warnings as string[] | undefined) ?? [];
            return (
              <li key={job.id} className="rounded-md border border-border bg-canvas p-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <Icon aria-hidden="true" className={`size-4 shrink-0 ${statusColor[job.status]} ${job.status === "running" ? "animate-spin" : ""}`} />
                  <span className="font-medium text-fg">{jobTypeLabel[job.type]}</span>
                  {job.providerId ? <span className="text-fg-subtle">· {job.providerId}</span> : null}
                  <span className={`ml-auto ${statusColor[job.status]}`}>{jobStatusLabel[job.status]}</span>
                </div>
                {active ? (
                  <div className="mt-2 space-y-1.5">
                    <ProgressBar value={job.progress} label={`Progresso: ${jobTypeLabel[job.type]}`} />
                    <div className="flex items-center justify-between text-fg-subtle">
                      <span>
                        {Math.round(job.progress * 100)}%{job.attempts > 1 ? ` · tentativa ${job.attempts}/${job.maxAttempts}` : ""}
                        {job.cancelRequested ? " · cancelando…" : ""}
                      </span>
                      {!job.cancelRequested ? (
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => void cancel(job)}>
                          Cancelar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                {job.status === "failed" && job.error ? <p className="mt-1.5 break-words text-danger">{job.error}</p> : null}
                {job.status === "queued" && job.error ? <p className="mt-1.5 break-words text-warning">Nova tentativa após erro: {job.error}</p> : null}
                {warnings.map((w) => (
                  <p key={w} className="mt-1.5 text-warning">
                    {w}
                  </p>
                ))}
                {job.type === "scene_detect" && job.status === "succeeded" ? (
                  <p className="mt-1.5 text-fg-muted">
                    {((job.output?.cuts as number[]) ?? []).length} corte(s) sugerido(s). Selecione o clipe na timeline para aplicar.
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-fg-subtle">{formatDateTime(job.createdAt)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
