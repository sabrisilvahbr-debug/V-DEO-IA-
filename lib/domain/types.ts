/**
 * Entidades de domínio do CINEMORPH AI. São independentes do banco usado
 * (SQLite local ou Supabase/PostgreSQL).
 */
import type { Timeline } from "./timeline";

export type AspectRatio = "16:9" | "9:16" | "1:1";
export const ASPECT_RATIOS: AspectRatio[] = ["16:9", "9:16", "1:1"];

export type Project = {
  id: string;
  ownerId: string;
  name: string;
  aspectRatio: AspectRatio;
  timeline: Timeline;
  createdAt: string;
  updatedAt: string;
};

export type ProjectSummary = Omit<Project, "timeline"> & {
  assetCount: number;
  thumbnailAssetId: string | null;
};

export type MediaKind = "video" | "image" | "audio";

/**
 * - source: enviado pelo usuário para uso no projeto
 * - reference: referência visual (estilo, figurino, personagem fictício)
 * - generated: produzido por um provedor de IA (ou pelo MOCK)
 * - render: exportação final feita pelo FFmpeg
 */
export type MediaRole = "source" | "reference" | "generated" | "render";

export type MediaAsset = {
  id: string;
  ownerId: string;
  projectId: string | null;
  kind: MediaKind;
  role: MediaRole;
  originalName: string;
  storageKey: string;
  thumbnailKey: string | null;
  mimeType: string;
  sizeBytes: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
  sha256: string;
  /** Origem declarada pelo usuário (ex.: "gravação própria", "banco de imagens X"). */
  origin: string | null;
  /** Usuário declarou ter direitos/consentimento sobre a mídia. */
  rightsConfirmed: boolean;
  /** Conteúdo produzido em modo de demonstração (MOCK). */
  isDemo: boolean;
  createdAt: string;
};

export type JobType = "generation" | "render" | "scene_detect";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export const ACTIVE_JOB_STATUSES: JobStatus[] = ["queued", "running"];

export type Job = {
  id: string;
  ownerId: string;
  projectId: string | null;
  type: JobType;
  status: JobStatus;
  providerId: string | null;
  providerJobId: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  progress: number;
  attempts: number;
  maxAttempts: number;
  idempotencyKey: string;
  cancelRequested: boolean;
  costEstimateCents: number | null;
  runAfter: string;
  lockedUntil: string | null;
  lockedBy: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type ProjectVersion = {
  id: string;
  ownerId: string;
  projectId: string;
  number: number;
  renderAssetId: string;
  timeline: Timeline;
  createdAt: string;
};

export type UsageEvent = {
  id: string;
  ownerId: string;
  jobId: string | null;
  providerId: string;
  kind: string;
  costCents: number;
  idempotencyKey: string;
  createdAt: string;
};

export type CurrentUser = {
  id: string;
  email: string | null;
};
