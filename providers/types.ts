import type { AspectRatio } from "@/lib/domain/types";

/**
 * Contrato comum dos provedores de vídeo generativo. Cada adaptador traduz
 * estes tipos para a API real do provedor; não existe endpoint universal.
 */
export type GenerationMode = "text_to_video" | "video_to_video";

export const generationModeLabel: Record<GenerationMode, string> = {
  text_to_video: "Texto para vídeo",
  video_to_video: "Vídeo para vídeo",
};

export type ProviderCapabilities = {
  modes: GenerationMode[];
  aspectRatios: AspectRatio[];
  minDurationSeconds: number;
  maxDurationSeconds: number;
  acceptsReferenceImages: boolean;
  /** Condicionamento por vídeo/pose que preserva movimento (sem garantia de fidelidade). */
  preservesMotion: boolean;
  maxInputVideoSeconds: number | null;
};

export type ProviderInfo = {
  id: string;
  name: string;
  /** Resultados são demonstrações, não vídeos de IA. */
  isDemo: boolean;
  /** Operações geram cobrança no provedor. */
  paid: boolean;
  docsUrl: string | null;
  /** Data da última verificação da documentação oficial. */
  verifiedAt: string | null;
  notes: string;
};

export type ProviderAvailability = { available: true } | { available: false; reason: string };

export type GenerationInput = {
  mode: GenerationMode;
  prompt: string;
  aspectRatio: AspectRatio;
  durationSeconds: number;
  /** Caminho local do vídeo de origem (video_to_video). */
  sourceVideoPath?: string;
  sourceVideoSeconds?: number;
  referenceImagePaths: string[];
};

export type CostEstimate = {
  known: boolean;
  cents: number | null;
  currency: "USD";
  basis: string;
};

export type ProviderJobState = "pending" | "running" | "succeeded" | "failed" | "canceled";

export type ProviderJobStatus = {
  state: ProviderJobState;
  progress?: number;
  error?: string;
};

export type ProviderResult = {
  filePath: string;
  cleanup: () => Promise<void>;
};

export type StartJobOptions = {
  /** Chave estável por tarefa, repassada ao provedor quando ele suportar. */
  idempotencyKey: string;
  signal?: AbortSignal;
};

export interface VideoProvider {
  readonly id: string;
  info(): ProviderInfo;
  availability(): Promise<ProviderAvailability>;
  getCapabilities(): Promise<ProviderCapabilities>;
  estimateCost(input: GenerationInput): Promise<CostEstimate>;
  startJob(input: GenerationInput, options: StartJobOptions): Promise<{ providerJobId: string }>;
  getJobStatus(providerJobId: string): Promise<ProviderJobStatus>;
  getResult(providerJobId: string): Promise<ProviderResult>;
  cancelJob?(providerJobId: string): Promise<void>;
}
