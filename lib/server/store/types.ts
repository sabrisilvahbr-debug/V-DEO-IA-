import type {
  AspectRatio,
  Job,
  JobStatus,
  JobType,
  MediaAsset,
  MediaKind,
  MediaRole,
  Project,
  ProjectSummary,
  ProjectVersion,
  UsageEvent,
} from "@/lib/domain/types";
import type { Timeline } from "@/lib/domain/timeline";

export type NewAsset = Omit<MediaAsset, "createdAt" | "ownerId">;

export type NewJob = {
  id: string;
  projectId: string | null;
  type: JobType;
  providerId: string | null;
  input: Record<string, unknown>;
  idempotencyKey: string;
  maxAttempts: number;
  costEstimateCents: number | null;
};

export type JobPatch = Partial<
  Pick<
    Job,
    | "status"
    | "providerJobId"
    | "output"
    | "error"
    | "progress"
    | "runAfter"
    | "lockedUntil"
    | "lockedBy"
    | "finishedAt"
  >
>;

/**
 * Operações de dados de um usuário. Toda leitura e escrita é filtrada pelo
 * `ownerId`; nenhuma implementação aceita o dono vindo do navegador.
 */
export interface UserDataStore {
  listProjects(ownerId: string, options?: { search?: string; limit?: number }): Promise<ProjectSummary[]>;
  getProject(ownerId: string, id: string): Promise<Project | null>;
  createProject(ownerId: string, data: { id: string; name: string; aspectRatio: AspectRatio; timeline: Timeline }): Promise<Project>;
  updateProject(
    ownerId: string,
    id: string,
    patch: { name?: string; aspectRatio?: AspectRatio; timeline?: Timeline },
  ): Promise<Project | null>;
  deleteProject(ownerId: string, id: string): Promise<boolean>;

  listAssets(
    ownerId: string,
    filter?: { projectId?: string; kind?: MediaKind; role?: MediaRole; limit?: number },
  ): Promise<MediaAsset[]>;
  getAsset(ownerId: string, id: string): Promise<MediaAsset | null>;
  getAssetsByIds(ownerId: string, ids: string[]): Promise<MediaAsset[]>;
  createAsset(ownerId: string, asset: NewAsset): Promise<MediaAsset>;
  deleteAsset(ownerId: string, id: string): Promise<boolean>;

  /** Cria o job ou devolve o existente com a mesma chave de idempotência. */
  createJob(ownerId: string, job: NewJob): Promise<{ job: Job; created: boolean }>;
  getJob(ownerId: string, id: string): Promise<Job | null>;
  listJobs(
    ownerId: string,
    filter?: { projectId?: string; statuses?: JobStatus[]; type?: JobType; limit?: number },
  ): Promise<Job[]>;
  requestJobCancel(ownerId: string, id: string): Promise<Job | null>;

  listVersions(ownerId: string, projectId: string): Promise<ProjectVersion[]>;
  createVersion(
    ownerId: string,
    data: { id: string; projectId: string; renderAssetId: string; timeline: Timeline },
  ): Promise<ProjectVersion>;

  /** Registra consumo. Ignora duplicatas pela chave de idempotência. */
  recordUsage(ownerId: string, event: Omit<UsageEvent, "ownerId" | "createdAt">): Promise<void>;
  listUsage(ownerId: string, options?: { since?: string; limit?: number }): Promise<UsageEvent[]>;
}

/**
 * Operações exclusivas do worker (sem contexto de usuário). Em modo Supabase
 * exigem a chave secreta, que nunca chega ao navegador.
 */
export interface WorkerDataStore {
  claimNextJob(workerId: string, leaseMs: number): Promise<Job | null>;
  extendLease(jobId: string, workerId: string, leaseMs: number): Promise<void>;
  updateJob(jobId: string, patch: JobPatch): Promise<Job | null>;
  getJobById(jobId: string): Promise<Job | null>;
  /** Devolve à fila jobs com lease expirado, ou falha os que esgotaram tentativas. */
  recoverExpiredJobs(): Promise<{ requeued: number; failed: number }>;
}

export type DataStore = UserDataStore & WorkerDataStore;
