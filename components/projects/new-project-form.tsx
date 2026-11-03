"use client";

import { FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, Select } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/client/api";
import type { AspectRatio, Project } from "@/lib/domain/types";

export function NewProjectForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const { project } = await api<{ project: Project }>("/api/projects", { method: "POST", json: { name, aspectRatio } });
      router.push(`/projetos/${project.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do novo projeto"
          aria-label="Nome do novo projeto"
          maxLength={120}
          required
          autoFocus={autoFocus}
          className="sm:max-w-xs"
        />
        <Select aria-label="Formato" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="h-10 sm:w-44">
          <option value="16:9">16:9 horizontal</option>
          <option value="9:16">9:16 vertical</option>
          <option value="1:1">1:1 quadrado</option>
        </Select>
        <Button type="submit" disabled={pending || !name.trim()}>
          <FolderPlus aria-hidden="true" />
          {pending ? "Criando…" : "Criar projeto"}
        </Button>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </form>
  );
}
