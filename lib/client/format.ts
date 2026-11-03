export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m} min ${String(s).padStart(2, "0")} s`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export const jobTypeLabel = { generation: "Geração", render: "Exportação", scene_detect: "Detecção de cenas" } as const;
export const jobStatusLabel = {
  queued: "Na fila",
  running: "Processando",
  succeeded: "Concluída",
  failed: "Falhou",
  canceled: "Cancelada",
} as const;

export const mediaRoleLabel = {
  source: "Enviado",
  reference: "Referência",
  generated: "Gerado",
  render: "Exportação",
} as const;

export const mediaKindLabel = { video: "Vídeo", image: "Imagem", audio: "Áudio" } as const;
