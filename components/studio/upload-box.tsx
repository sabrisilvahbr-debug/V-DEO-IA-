"use client";

import { Upload, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Checkbox, ProgressBar } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { errorMessage, uploadFile } from "@/lib/client/api";
import { formatBytes } from "@/lib/client/format";
import type { MediaAsset } from "@/lib/domain/types";

const ACCEPT = "video/mp4,video/quicktime,video/webm,video/x-matroska,image/png,image/jpeg,image/webp,audio/mpeg,audio/wav,audio/mp4,.mkv,.m4a";

type UploadItem = { id: string; name: string; size: number; progress: number; status: "uploading" | "processing" | "done" | "error"; error?: string };

/**
 * Envio de mídia com confirmação de direitos/consentimento, origem
 * declarada, progresso e mensagens de erro objetivas por arquivo.
 */
export function UploadBox({
  projectId,
  role = "source",
  maxUploadMb,
  disabledReason,
  onUploaded,
}: {
  projectId: string | null;
  role?: "source" | "reference";
  maxUploadMb: number;
  disabledReason?: string | null;
  onUploaded: (asset: MediaAsset) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rights, setRights] = useState(false);
  const [origin, setOrigin] = useState("");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const update = (id: string, patch: Partial<UploadItem>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  async function send(files: FileList | File[]) {
    if (disabledReason) return;
    if (!rights) {
      setNotice("Confirme que você tem direitos ou consentimento sobre a mídia antes de enviar.");
      return;
    }
    setNotice(null);
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID();
      if (file.size > maxUploadMb * 1024 * 1024) {
        setItems((c) => [{ id, name: file.name, size: file.size, progress: 0, status: "error", error: `Acima do limite de ${maxUploadMb} MB.` }, ...c]);
        continue;
      }
      setItems((c) => [{ id, name: file.name, size: file.size, progress: 0, status: "uploading" }, ...c]);
      const params = new URLSearchParams({ role, name: file.name, rights: "1" });
      if (projectId) params.set("projectId", projectId);
      if (origin.trim()) params.set("origin", origin.trim());
      try {
        const { asset } = await uploadFile<{ asset: MediaAsset }>(`/api/uploads?${params}`, file, (p) =>
          update(id, p >= 1 ? { progress: 1, status: "processing" } : { progress: p }),
        );
        update(id, { status: "done", progress: 1 });
        onUploaded(asset);
        setTimeout(() => setItems((c) => c.filter((i) => i.id !== id)), 2500);
      } catch (error) {
        update(id, { status: "error", error: errorMessage(error) });
      }
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) void send(event.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      {disabledReason ? <Alert tone="warning">{disabledReason}</Alert> : null}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center gap-2 rounded-md border border-dashed px-3 py-4 text-center transition-colors ${
          dragging ? "border-accent bg-accent/5" : "border-border-strong bg-canvas"
        }`}
      >
        <Upload aria-hidden="true" className="size-5 text-fg-subtle" />
        <p className="text-xs text-fg-muted">
          Arraste arquivos aqui ou{" "}
          <button
            type="button"
            className="font-medium text-accent underline-offset-4 hover:underline disabled:opacity-50"
            onClick={() => inputRef.current?.click()}
            disabled={Boolean(disabledReason)}
          >
            escolha no computador
          </button>
        </p>
        <p className="text-[11px] text-fg-subtle">Vídeo, imagem ou áudio · até {maxUploadMb} MB</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label="Selecionar arquivos"
          onChange={(e) => {
            if (e.target.files?.length) void send(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <Input
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
        placeholder="Origem (opcional): ex. gravação própria"
        aria-label="Origem da mídia"
        className="h-8 text-xs"
        maxLength={200}
      />
      <Checkbox
        checked={rights}
        onChange={(e) => setRights(e.target.checked)}
        label="Tenho os direitos sobre esta mídia e o consentimento das pessoas que aparecem nela."
      />
      {notice ? <Alert tone="warning">{notice}</Alert> : null}
      {items.length ? (
        <ul className="space-y-2" aria-live="polite">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border border-border bg-canvas p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-fg">{item.name}</span>
                <span className="shrink-0 text-fg-subtle">{formatBytes(item.size)}</span>
                {item.status === "error" ? (
                  <Button variant="ghost" size="icon" className="size-6" aria-label="Dispensar" onClick={() => setItems((c) => c.filter((i) => i.id !== item.id))}>
                    <X />
                  </Button>
                ) : null}
              </div>
              {item.status === "error" ? (
                <p className="mt-1 text-danger">{item.error}</p>
              ) : (
                <div className="mt-1.5 space-y-1">
                  <ProgressBar value={item.progress} label={`Envio de ${item.name}`} />
                  <p className="text-fg-subtle">
                    {item.status === "uploading" ? `Enviando… ${Math.round(item.progress * 100)}%` : item.status === "processing" ? "Validando e gerando miniatura…" : "Pronto"}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
