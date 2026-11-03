"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Field, NumberInput, Select, Textarea } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import type { SceneFields } from "@/lib/api/schemas";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import { formatCents } from "@/lib/client/money";
import type { AspectRatio, MediaAsset } from "@/lib/domain/types";
import { composePrompt, sceneFieldLabels } from "@/lib/prompt-director";
import { generationModeLabel, type CostEstimate, type GenerationMode } from "@/providers/types";
import type { PublicJob, StudioProvider } from "./types";

type Quote =
  | { ok: true; provider: { id: string; name: string; isDemo: boolean; paid: boolean }; estimate: CostEstimate }
  | { ok: false; reason: string; rejected: Array<{ id: string; reason: string }> };

const emptyScene: SceneFields = { subject: "", action: "", environment: "", camera: "", lighting: "", style: "", movement: "" };

/**
 * Diretor de prompts + geração. Mostra o provedor escolhido pelo roteador e
 * o custo estimado antes de enfileirar; operações pagas exigem confirmação.
 */
export function GeneratePanel({
  projectId,
  defaultAspectRatio,
  providers,
  assets,
  onQueued,
}: {
  projectId: string;
  defaultAspectRatio: AspectRatio;
  providers: StudioProvider[];
  assets: MediaAsset[];
  onQueued: (job: PublicJob) => void;
}) {
  const [mode, setMode] = useState<GenerationMode>("text_to_video");
  const [providerId, setProviderId] = useState("auto");
  const [description, setDescription] = useState("");
  const [scene, setScene] = useState<SceneFields>(emptyScene);
  const [showDirector, setShowDirector] = useState(false);
  const [promptOverride, setPromptOverride] = useState<string | null>(null);
  const [sourceAssetId, setSourceAssetId] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(defaultAspectRatio);
  const [duration, setDuration] = useState(5);
  const [rawQuote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmCost, setConfirmCost] = useState(false);

  const videoSources = assets.filter((a) => a.kind === "video" && a.role !== "render");
  const composed = composePrompt(description, scene);
  const prompt = promptOverride ?? composed;
  const availableProviders = providers.filter((p) => p.availability.available);

  const request = useMemo(
    () => ({
      projectId,
      mode,
      providerId,
      prompt,
      scene,
      sourceAssetId: mode === "video_to_video" && sourceAssetId ? sourceAssetId : undefined,
      referenceAssetIds: [] as string[],
      aspectRatio,
      durationSeconds: duration,
    }),
    [projectId, mode, providerId, prompt, scene, sourceAssetId, aspectRatio, duration],
  );

  const ready = prompt.trim().length >= 3 && (mode === "text_to_video" || Boolean(sourceAssetId));

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setQuoting(true);
      try {
        setQuote(await api<Quote>("/api/quotes", { method: "POST", json: request, signal: controller.signal }));
      } catch (e) {
        if (!controller.signal.aborted) setQuote({ ok: false, reason: errorMessage(e), rejected: [] });
      } finally {
        if (!controller.signal.aborted) setQuoting(false);
      }
    }, 500);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [request, ready]);

  // Sem dados suficientes, nenhuma cotação anterior é exibida (estado derivado)
  const quote = ready ? rawQuote : null;
  const needsConfirmation = quote?.ok && (quote.provider.paid || !quote.estimate.known || (quote.estimate.cents ?? 0) > 0);

  async function submit() {
    if (!quote?.ok) return;
    if (needsConfirmation && !confirmCost) {
      setError("Confirme o custo antes de gerar.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const { job } = await api<{ job: PublicJob }>("/api/generations", {
        method: "POST",
        json: {
          ...request,
          providerId: quote.provider.id,
          confirmedCostCents: quote.estimate.known ? quote.estimate.cents ?? undefined : undefined,
          acceptUnknownCost: !quote.estimate.known && confirmCost,
          clientRequestId: crypto.randomUUID(),
        },
      });
      onQueued(job);
      setSuccess("Geração enviada para a fila. Acompanhe em Tarefas.");
      setConfirmCost(false);
    } catch (e) {
      setError(e instanceof ApiError ? errorMessage(e) : "Falha ao enviar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (availableProviders.length === 0) {
    return (
      <div className="p-3">
        <Alert tone="warning">
          Nenhum provedor de geração está disponível. O MOCK precisa do FFmpeg; integrações reais serão adicionadas na etapa 6.
        </Alert>
      </div>
    );
  }

  return (
    <form
      className="space-y-3 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-2">
        <Field label="Modalidade">
          {(id) => (
            <Select id={id} value={mode} onChange={(e) => setMode(e.target.value as GenerationMode)}>
              {(Object.keys(generationModeLabel) as GenerationMode[]).map((m) => (
                <option key={m} value={m}>
                  {generationModeLabel[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Modelo">
          {(id) => (
            <Select id={id} value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              <option value="auto">Automático</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.availability.available}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {mode === "video_to_video" ? (
        <Field label="Vídeo de origem" hint={videoSources.length === 0 ? "Envie um vídeo na aba Mídia primeiro." : undefined}>
          {(id) => (
            <Select id={id} value={sourceAssetId} onChange={(e) => setSourceAssetId(e.target.value)}>
              <option value="">Selecione…</option>
              {videoSources.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.originalName}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}

      <Field label="Descreva a cena">
        {(id) => (
          <Textarea
            id={id}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setPromptOverride(null);
            }}
            placeholder="Ex.: uma rua de cidade à noite, chuva fina, letreiros de neon refletindo no asfalto"
            maxLength={1500}
          />
        )}
      </Field>

      <div className="rounded-md border border-border">
        <button
          type="button"
          aria-expanded={showDirector}
          onClick={() => setShowDirector((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-fg-muted hover:text-fg"
        >
          Diretor de cena (opcional)
          <ChevronDown aria-hidden="true" className={`size-4 transition-transform ${showDirector ? "rotate-180" : ""}`} />
        </button>
        {showDirector ? (
          <div className="grid gap-2 border-t border-border p-3">
            {(Object.keys(sceneFieldLabels) as (keyof SceneFields)[]).map((key) => (
              <Field key={key} label={sceneFieldLabels[key]}>
                {(id) => (
                  <Input
                    id={id}
                    className="h-8 text-xs"
                    value={scene[key]}
                    maxLength={200}
                    onChange={(e) => {
                      setScene((s) => ({ ...s, [key]: e.target.value }));
                      setPromptOverride(null);
                    }}
                  />
                )}
              </Field>
            ))}
          </div>
        ) : null}
      </div>

      <Field label="Prompt final (editável)" hint="Montado a partir da descrição e do diretor de cena. Você pode ajustar o texto.">
        {(id) => (
          <Textarea id={id} value={prompt} onChange={(e) => setPromptOverride(e.target.value)} className="min-h-24 font-mono text-xs" maxLength={2000} />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Proporção">
          {(id) => (
            <Select id={id} value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}>
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
            </Select>
          )}
        </Field>
        <Field label="Duração (s)">
          {(id) => <NumberInput id={id} min={1} max={30} value={duration} onChange={(e) => setDuration(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} />}
        </Field>
      </div>

      <div className="rounded-md border border-border bg-canvas p-3 text-xs" aria-live="polite">
        {!ready ? (
          <p className="text-fg-subtle">Descreva a cena{mode === "video_to_video" ? " e escolha o vídeo de origem" : ""} para ver o provedor e o custo.</p>
        ) : quoting && !quote ? (
          <p className="text-fg-subtle">Consultando provedores…</p>
        ) : quote && !quote.ok ? (
          <div className="space-y-1 text-danger">
            <p>{quote.reason}</p>
            {quote.rejected.map((r) => (
              <p key={r.id} className="text-fg-subtle">
                {r.id}: {r.reason}
              </p>
            ))}
          </div>
        ) : quote?.ok ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-fg">{quote.provider.name}</span>
              <span className="font-mono text-fg">{quote.estimate.known ? formatCents(quote.estimate.cents ?? 0) : "Custo desconhecido"}</span>
            </div>
            <p className="text-fg-subtle">{quote.estimate.basis}</p>
            {quote.provider.isDemo ? (
              <p className="rounded border border-warning/30 bg-warning/10 px-2 py-1 text-warning">Demonstração: o resultado não é gerado por IA.</p>
            ) : null}
            {needsConfirmation ? (
              <label className="flex items-start gap-2 text-warning">
                <input type="checkbox" className="mt-0.5 accent-[var(--color-accent)]" checked={confirmCost} onChange={(e) => setConfirmCost(e.target.checked)} />
                {quote.estimate.known
                  ? `Autorizo a cobrança estimada de ${formatCents(quote.estimate.cents ?? 0)} pelo provedor.`
                  : "Entendo que o custo é desconhecido e autorizo a operação."}
              </label>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}

      <Button type="submit" className="w-full" disabled={!quote?.ok || submitting || (Boolean(needsConfirmation) && !confirmCost)}>
        <Sparkles aria-hidden="true" />
        {submitting ? "Enviando…" : "Gerar"}
      </Button>
    </form>
  );
}
