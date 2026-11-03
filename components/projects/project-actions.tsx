"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/client/api";

/** Renomear, duplicar e excluir (exclusão em dois passos, sem diálogos do navegador). */
export function ProjectActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "rename" | "confirm-delete">("idle");
  const [value, setValue] = useState(name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await action();
      setMode("idle");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  if (mode === "rename") {
    return (
      <form
        className="flex items-center gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => api(`/api/projects/${id}`, { method: "PATCH", json: { name: value } }));
        }}
      >
        <Input value={value} onChange={(e) => setValue(e.target.value)} aria-label="Novo nome" className="h-8 text-xs" maxLength={120} autoFocus />
        <Button size="sm" type="submit" disabled={pending || !value.trim()} className="h-8">
          Salvar
        </Button>
        <Button size="sm" variant="ghost" className="h-8" onClick={() => setMode("idle")}>
          Cancelar
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {mode === "confirm-delete" ? (
        <>
          <span className="text-xs text-danger">Excluir projeto, mídias e exportações?</span>
          <Button size="sm" variant="danger" className="h-7 px-2 text-xs" disabled={pending} onClick={() => void run(() => api(`/api/projects/${id}`, { method: "DELETE" }))}>
            {pending ? "Excluindo…" : "Excluir"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setMode("idle")}>
            Cancelar
          </Button>
        </>
      ) : (
        <>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setMode("rename")}>
            <Pencil aria-hidden="true" />
            Renomear
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={pending} onClick={() => void run(() => api(`/api/projects/${id}/duplicate`, { method: "POST" }))}>
            <Copy aria-hidden="true" />
            {pending ? "Duplicando…" : "Duplicar"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" aria-label={`Excluir ${name}`} onClick={() => setMode("confirm-delete")}>
            <Trash2 aria-hidden="true" />
          </Button>
        </>
      )}
      {error ? <p className="w-full text-xs text-danger">{error}</p> : null}
    </div>
  );
}
