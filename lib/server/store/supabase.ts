import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTimeline, type Timeline } from "@/lib/domain/timeline";
import type {
  AspectRatio,
  Job,
  MediaAsset,
  Project,
  ProjectSummary,
  ProjectVersion,
  UsageEvent,
} from "@/lib/domain/types";
import type { DataStore, JobPatch, NewAsset, NewJob } from "./types";

/**
 * Implementação Supabase/PostgreSQL.
 *
 * - Com o cliente do usuário (chave publicável + sessão), o RLS garante o
 *   isolamento e o código também filtra por `owner_id`.
 * - Com o cliente do worker (chave secreta), o RLS é ignorado; por isso as
 *   operações do worker só existem nesta classe e nunca são expostas em rotas.
 *
 * ATENÇÃO: esta implementação ainda não foi executada contra um projeto
 * Supabase real (ver docs/supabase.md).
 */
type Row = Record<string, unknown>;

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`Supabase (${context}): ${error?.message ?? "erro desconhecido"}`);
}

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function toProject(row: Row): Project {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    name: String(row.name),
    aspectRatio: row.aspect_ratio as AspectRatio,
    timeline: parseTimeline(row.timeline),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toAsset(row: Row): MediaAsset {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    projectId: str(row.project_id),
    kind: row.kind as MediaAsset["kind"],
    role: row.role as MediaAsset["role"],
    originalName: String(row.original_name),
    storageKey: String(row.storage_key),
    thumbnailKey: str(row.thumbnail_key),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    durationMs: num(row.duration_ms),
    width: num(row.width),
    height: num(row.height),
    hasAudio: Boolean(row.has_audio),
    sha256: String(row.sha256),
    origin: str(row.origin),
    rightsConfirmed: Boolean(row.rights_confirmed),
    isDemo: Boolean(row.is_demo),
    createdAt: String(row.created_at),
  };
}

function toJob(row: Row): Job {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    projectId: str(row.project_id),
    type: row.type as Job["type"],
    status: row.status as Job["status"],
    providerId: str(row.provider_id),
    providerJobId: str(row.provider_job_id),
    input: (row.input as Record<string, unknown>) ?? {},
    output: (row.output as Record<string, unknown> | null) ?? null,
    error: str(row.error),
    progress: Number(row.progress ?? 0),
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 3),
    idempotencyKey: String(row.idempotency_key),
    cancelRequested: Boolean(row.cancel_requested),
    costEstimateCents: num(row.cost_estimate_cents),
    runAfter: String(row.run_after),
    lockedUntil: str(row.locked_until),
    lockedBy: str(row.locked_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    startedAt: str(row.started_at),
    finishedAt: str(row.finished_at),
  };
}

function toVersion(row: Row): ProjectVersion {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    projectId: String(row.project_id),
    number: Number(row.number),
    renderAssetId: String(row.render_asset_id),
    timeline: parseTimeline(row.timeline),
    createdAt: String(row.created_at),
  };
}

export class SupabaseDataStore implements DataStore {
  constructor(private readonly client: SupabaseClient) {}

  async listProjects(ownerId: string, options: { search?: string; limit?: number } = {}) {
    let query = this.client
      .from("projects")
      .select("id, owner_id, name, aspect_ratio, created_at, updated_at")
      .eq("owner_id", ownerId)
      .order("updated_at", { ascending: false })
      .limit(options.limit ?? 200);
    const search = options.search?.trim();
    if (search) query = query.ilike("name", `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const { data, error } = await query;
    if (error) fail("listProjects", error);

    const ids = (data ?? []).map((row) => String(row.id));
    const assets = ids.length
      ? await this.client
          .from("media_assets")
          .select("id, project_id, thumbnail_key, created_at")
          .eq("owner_id", ownerId)
          .in("project_id", ids)
          .order("created_at", { ascending: false })
      : { data: [], error: null };
    if (assets.error) fail("listProjects/assets", assets.error);

    return (data ?? []).map((row): ProjectSummary => {
      const own = (assets.data ?? []).filter((a) => a.project_id === row.id);
      return {
        id: String(row.id),
        ownerId: String(row.owner_id),
        name: String(row.name),
        aspectRatio: row.aspect_ratio as AspectRatio,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        assetCount: own.length,
        thumbnailAssetId: own.find((a) => a.thumbnail_key)?.id ?? null,
      };
    });
  }

  async getProject(ownerId: string, id: string) {
    const { data, error } = await this.client.from("projects").select("*").eq("id", id).eq("owner_id", ownerId).maybeSingle();
    if (error) fail("getProject", error);
    return data ? toProject(data) : null;
  }

  async createProject(ownerId: string, data: { id: string; name: string; aspectRatio: AspectRatio; timeline: Timeline }) {
    const { data: row, error } = await this.client
      .from("projects")
      .insert({ id: data.id, owner_id: ownerId, name: data.name, aspect_ratio: data.aspectRatio, timeline: data.timeline })
      .select("*")
      .single();
    if (error) fail("createProject", error);
    return toProject(row);
  }

  async updateProject(ownerId: string, id: string, patch: { name?: string; aspectRatio?: AspectRatio; timeline?: Timeline }) {
    const update: Row = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.aspectRatio !== undefined) update.aspect_ratio = patch.aspectRatio;
    if (patch.timeline !== undefined) update.timeline = patch.timeline;
    const { data, error } = await this.client
      .from("projects")
      .update(update)
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select("*")
      .maybeSingle();
    if (error) fail("updateProject", error);
    return data ? toProject(data) : null;
  }

  async deleteProject(ownerId: string, id: string) {
    const { data, error } = await this.client.from("projects").delete().eq("id", id).eq("owner_id", ownerId).select("id");
    if (error) fail("deleteProject", error);
    return (data ?? []).length > 0;
  }

  async listAssets(
    ownerId: string,
    filter: { projectId?: string; kind?: MediaAsset["kind"]; role?: MediaAsset["role"]; limit?: number } = {},
  ) {
    let query = this.client
      .from("media_assets")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(filter.limit ?? 500);
    if (filter.projectId) query = query.eq("project_id", filter.projectId);
    if (filter.kind) query = query.eq("kind", filter.kind);
    if (filter.role) query = query.eq("role", filter.role);
    const { data, error } = await query;
    if (error) fail("listAssets", error);
    return (data ?? []).map(toAsset);
  }

  async getAsset(ownerId: string, id: string) {
    const { data, error } = await this.client.from("media_assets").select("*").eq("id", id).eq("owner_id", ownerId).maybeSingle();
    if (error) fail("getAsset", error);
    return data ? toAsset(data) : null;
  }

  async getAssetsByIds(ownerId: string, ids: string[]) {
    if (ids.length === 0) return [];
    const { data, error } = await this.client.from("media_assets").select("*").eq("owner_id", ownerId).in("id", ids);
    if (error) fail("getAssetsByIds", error);
    return (data ?? []).map(toAsset);
  }

  async createAsset(ownerId: string, asset: NewAsset) {
    const { data, error } = await this.client
      .from("media_assets")
      .insert({
        id: asset.id,
        owner_id: ownerId,
        project_id: asset.projectId,
        kind: asset.kind,
        role: asset.role,
        original_name: asset.originalName,
        storage_key: asset.storageKey,
        thumbnail_key: asset.thumbnailKey,
        mime_type: asset.mimeType,
        size_bytes: asset.sizeBytes,
        duration_ms: asset.durationMs,
        width: asset.width,
        height: asset.height,
        has_audio: asset.hasAudio,
        sha256: asset.sha256,
        origin: asset.origin,
        rights_confirmed: asset.rightsConfirmed,
        is_demo: asset.isDemo,
      })
      .select("*")
      .single();
    if (error) fail("createAsset", error);
    return toAsset(data);
  }

  async deleteAsset(ownerId: string, id: string) {
    const { data, error } = await this.client.from("media_assets").delete().eq("id", id).eq("owner_id", ownerId).select("id");
    if (error) fail("deleteAsset", error);
    return (data ?? []).length > 0;
  }

  async createJob(ownerId: string, job: NewJob) {
    const existing = await this.client
      .from("jobs")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("idempotency_key", job.idempotencyKey)
      .maybeSingle();
    if (existing.error) fail("createJob/lookup", existing.error);
    if (existing.data) return { job: toJob(existing.data), created: false };

    const { data, error } = await this.client
      .from("jobs")
      .insert({
        id: job.id,
        owner_id: ownerId,
        project_id: job.projectId,
        type: job.type,
        provider_id: job.providerId,
        input: job.input,
        max_attempts: job.maxAttempts,
        idempotency_key: job.idempotencyKey,
        cost_estimate_cents: job.costEstimateCents,
      })
      .select("*")
      .single();
    if (error) {
      // Corrida: outra requisição criou o mesmo job entre a busca e a inserção.
      if (error.code === "23505") {
        const again = await this.client.from("jobs").select("*").eq("owner_id", ownerId).eq("idempotency_key", job.idempotencyKey).single();
        if (again.error) fail("createJob/retry", again.error);
        return { job: toJob(again.data), created: false };
      }
      fail("createJob", error);
    }
    return { job: toJob(data), created: true };
  }

  async getJob(ownerId: string, id: string) {
    const { data, error } = await this.client.from("jobs").select("*").eq("id", id).eq("owner_id", ownerId).maybeSingle();
    if (error) fail("getJob", error);
    return data ? toJob(data) : null;
  }

  async listJobs(
    ownerId: string,
    filter: { projectId?: string; statuses?: Job["status"][]; type?: Job["type"]; limit?: number } = {},
  ) {
    let query = this.client
      .from("jobs")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(filter.limit ?? 50);
    if (filter.projectId) query = query.eq("project_id", filter.projectId);
    if (filter.type) query = query.eq("type", filter.type);
    if (filter.statuses?.length) query = query.in("status", filter.statuses);
    const { data, error } = await query;
    if (error) fail("listJobs", error);
    return (data ?? []).map(toJob);
  }

  async requestJobCancel(ownerId: string, id: string) {
    const { data, error } = await this.client.rpc("request_job_cancel", { p_job_id: id });
    if (error) fail("requestJobCancel", error);
    const row = data as Row | null;
    return row && row.id && String(row.owner_id) === ownerId ? toJob(row) : null;
  }

  async listVersions(ownerId: string, projectId: string) {
    const { data, error } = await this.client
      .from("project_versions")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("project_id", projectId)
      .order("number", { ascending: false });
    if (error) fail("listVersions", error);
    return (data ?? []).map(toVersion);
  }

  async createVersion(ownerId: string, data: { id: string; projectId: string; renderAssetId: string; timeline: Timeline }) {
    const last = await this.client
      .from("project_versions")
      .select("number")
      .eq("project_id", data.projectId)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last.error) fail("createVersion/last", last.error);
    const { data: row, error } = await this.client
      .from("project_versions")
      .insert({
        id: data.id,
        owner_id: ownerId,
        project_id: data.projectId,
        number: Number(last.data?.number ?? 0) + 1,
        render_asset_id: data.renderAssetId,
        timeline: data.timeline,
      })
      .select("*")
      .single();
    if (error) fail("createVersion", error);
    return toVersion(row);
  }

  async recordUsage(ownerId: string, event: Omit<UsageEvent, "ownerId" | "createdAt">) {
    const { error } = await this.client.from("usage_events").upsert(
      {
        id: event.id,
        owner_id: ownerId,
        job_id: event.jobId,
        provider_id: event.providerId,
        kind: event.kind,
        cost_cents: event.costCents,
        idempotency_key: event.idempotencyKey,
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    );
    if (error) fail("recordUsage", error);
  }

  async listUsage(ownerId: string, options: { since?: string; limit?: number } = {}) {
    let query = this.client
      .from("usage_events")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false })
      .limit(options.limit ?? 500);
    if (options.since) query = query.gte("created_at", options.since);
    const { data, error } = await query;
    if (error) fail("listUsage", error);
    return (data ?? []).map(
      (row): UsageEvent => ({
        id: String(row.id),
        ownerId: String(row.owner_id),
        jobId: str(row.job_id),
        providerId: String(row.provider_id),
        kind: String(row.kind),
        costCents: Number(row.cost_cents),
        idempotencyKey: String(row.idempotency_key),
        createdAt: String(row.created_at),
      }),
    );
  }

  // ---------- worker (exige chave secreta) ----------

  async claimNextJob(workerId: string, leaseMs: number) {
    const { data, error } = await this.client.rpc("claim_next_job", {
      p_worker: workerId,
      p_lease_seconds: Math.ceil(leaseMs / 1000),
    });
    if (error) fail("claimNextJob", error);
    const rows = (data ?? []) as Row[];
    return rows.length ? toJob(rows[0]) : null;
  }

  async extendLease(jobId: string, workerId: string, leaseMs: number) {
    const { error } = await this.client
      .from("jobs")
      .update({ locked_until: new Date(Date.now() + leaseMs).toISOString(), updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("locked_by", workerId)
      .eq("status", "running");
    if (error) fail("extendLease", error);
  }

  async updateJob(jobId: string, patch: JobPatch) {
    const columns: Record<keyof JobPatch, string> = {
      status: "status",
      providerJobId: "provider_job_id",
      output: "output",
      error: "error",
      progress: "progress",
      runAfter: "run_after",
      lockedUntil: "locked_until",
      lockedBy: "locked_by",
      finishedAt: "finished_at",
    };
    const update: Row = { updated_at: new Date().toISOString() };
    for (const [key, value] of Object.entries(patch) as [keyof JobPatch, unknown][]) {
      if (value !== undefined) update[columns[key]] = value;
    }
    const { data, error } = await this.client.from("jobs").update(update).eq("id", jobId).select("*").maybeSingle();
    if (error) fail("updateJob", error);
    return data ? toJob(data) : null;
  }

  async getJobById(jobId: string) {
    const { data, error } = await this.client.from("jobs").select("*").eq("id", jobId).maybeSingle();
    if (error) fail("getJobById", error);
    return data ? toJob(data) : null;
  }

  async recoverExpiredJobs() {
    const { data, error } = await this.client.rpc("recover_expired_jobs");
    if (error) fail("recoverExpiredJobs", error);
    const result = (data ?? {}) as { failed?: number; requeued?: number };
    return { failed: Number(result.failed ?? 0), requeued: Number(result.requeued ?? 0) };
  }
}
