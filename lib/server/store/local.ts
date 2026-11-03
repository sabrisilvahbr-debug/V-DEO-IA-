import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
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
import { sqliteMigrations } from "./sqlite-schema";
import type { DataStore, JobPatch, NewAsset, NewJob } from "./types";

type Row = Record<string, SQLInputValue>;

const now = () => new Date().toISOString();

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function toProject(row: Row): Project {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    name: String(row.name),
    aspectRatio: row.aspect_ratio as AspectRatio,
    timeline: parseTimeline(parseJson(row.timeline, null)),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toAsset(row: Row): MediaAsset {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    projectId: row.project_id === null ? null : String(row.project_id),
    kind: row.kind as MediaAsset["kind"],
    role: row.role as MediaAsset["role"],
    originalName: String(row.original_name),
    storageKey: String(row.storage_key),
    thumbnailKey: row.thumbnail_key === null ? null : String(row.thumbnail_key),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
    width: row.width === null ? null : Number(row.width),
    height: row.height === null ? null : Number(row.height),
    hasAudio: Number(row.has_audio) === 1,
    sha256: String(row.sha256),
    origin: row.origin === null ? null : String(row.origin),
    rightsConfirmed: Number(row.rights_confirmed) === 1,
    isDemo: Number(row.is_demo) === 1,
    createdAt: String(row.created_at),
  };
}

function toJob(row: Row): Job {
  const str = (v: SQLInputValue) => (v === null || v === undefined ? null : String(v));
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    projectId: str(row.project_id),
    type: row.type as Job["type"],
    status: row.status as Job["status"],
    providerId: str(row.provider_id),
    providerJobId: str(row.provider_job_id),
    input: parseJson(row.input, {}),
    output: parseJson(row.output, null),
    error: str(row.error),
    progress: Number(row.progress),
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    idempotencyKey: String(row.idempotency_key),
    cancelRequested: Number(row.cancel_requested) === 1,
    costEstimateCents: row.cost_estimate_cents === null ? null : Number(row.cost_estimate_cents),
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
    timeline: parseTimeline(parseJson(row.timeline, null)),
    createdAt: String(row.created_at),
  };
}

/**
 * Implementação local com SQLite (módulo `node:sqlite`, Node 22.13+).
 * Usa WAL para permitir que o servidor web e o worker acessem o mesmo arquivo.
 */
export class LocalDataStore implements DataStore {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    this.migrate();
  }

  private migrate() {
    this.db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
    const row = this.db.prepare("SELECT MAX(version) AS v FROM schema_migrations").get() as Row | undefined;
    const current = row?.v === null || row?.v === undefined ? 0 : Number(row.v);
    sqliteMigrations.forEach((sql, index) => {
      const version = index + 1;
      if (version <= current) return;
      this.transaction(() => {
        this.db.exec(sql);
        this.db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(version, now());
      });
    });
  }

  private transaction<T>(fn: () => T, mode: "DEFERRED" | "IMMEDIATE" = "DEFERRED"): T {
    this.db.exec(`BEGIN ${mode}`);
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close() {
    this.db.close();
  }

  // ---------- Projetos ----------

  async listProjects(ownerId: string, options: { search?: string; limit?: number } = {}) {
    const search = options.search?.trim();
    const rows = this.db
      .prepare(
        `SELECT p.id, p.owner_id, p.name, p.aspect_ratio, p.created_at, p.updated_at,
           (SELECT COUNT(*) FROM media_assets a WHERE a.project_id = p.id) AS asset_count,
           (SELECT a.id FROM media_assets a WHERE a.project_id = p.id AND a.thumbnail_key IS NOT NULL
              ORDER BY a.created_at DESC LIMIT 1) AS thumb_id
         FROM projects p
         WHERE p.owner_id = ? ${search ? "AND p.name LIKE ? ESCAPE '\\'" : ""}
         ORDER BY p.updated_at DESC
         LIMIT ?`,
      )
      .all(...([ownerId, ...(search ? [`%${escapeLike(search)}%`] : []), options.limit ?? 200] as SQLInputValue[])) as Row[];

    return rows.map(
      (row): ProjectSummary => ({
        id: String(row.id),
        ownerId: String(row.owner_id),
        name: String(row.name),
        aspectRatio: row.aspect_ratio as AspectRatio,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        assetCount: Number(row.asset_count),
        thumbnailAssetId: row.thumb_id === null ? null : String(row.thumb_id),
      }),
    );
  }

  async getProject(ownerId: string, id: string) {
    const row = this.db.prepare("SELECT * FROM projects WHERE id = ? AND owner_id = ?").get(id, ownerId) as Row | undefined;
    return row ? toProject(row) : null;
  }

  async createProject(
    ownerId: string,
    data: { id: string; name: string; aspectRatio: AspectRatio; timeline: Timeline },
  ) {
    const ts = now();
    this.db
      .prepare(
        "INSERT INTO projects (id, owner_id, name, aspect_ratio, timeline, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(data.id, ownerId, data.name, data.aspectRatio, json(data.timeline), ts, ts);
    return (await this.getProject(ownerId, data.id))!;
  }

  async updateProject(
    ownerId: string,
    id: string,
    patch: { name?: string; aspectRatio?: AspectRatio; timeline?: Timeline },
  ) {
    const sets: string[] = [];
    const values: SQLInputValue[] = [];
    if (patch.name !== undefined) {
      sets.push("name = ?");
      values.push(patch.name);
    }
    if (patch.aspectRatio !== undefined) {
      sets.push("aspect_ratio = ?");
      values.push(patch.aspectRatio);
    }
    if (patch.timeline !== undefined) {
      sets.push("timeline = ?");
      values.push(json(patch.timeline));
    }
    sets.push("updated_at = ?");
    values.push(now());
    const result = this.db
      .prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ? AND owner_id = ?`)
      .run(...values, id, ownerId);
    return result.changes > 0 ? this.getProject(ownerId, id) : null;
  }

  async deleteProject(ownerId: string, id: string) {
    const result = this.db.prepare("DELETE FROM projects WHERE id = ? AND owner_id = ?").run(id, ownerId);
    return result.changes > 0;
  }

  // ---------- Mídias ----------

  async listAssets(
    ownerId: string,
    filter: { projectId?: string; kind?: MediaAsset["kind"]; role?: MediaAsset["role"]; limit?: number } = {},
  ) {
    const where = ["owner_id = ?"];
    const values: SQLInputValue[] = [ownerId];
    if (filter.projectId) {
      where.push("project_id = ?");
      values.push(filter.projectId);
    }
    if (filter.kind) {
      where.push("kind = ?");
      values.push(filter.kind);
    }
    if (filter.role) {
      where.push("role = ?");
      values.push(filter.role);
    }
    const rows = this.db
      .prepare(`SELECT * FROM media_assets WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`)
      .all(...values, filter.limit ?? 500) as Row[];
    return rows.map(toAsset);
  }

  async getAsset(ownerId: string, id: string) {
    const row = this.db.prepare("SELECT * FROM media_assets WHERE id = ? AND owner_id = ?").get(id, ownerId) as Row | undefined;
    return row ? toAsset(row) : null;
  }

  async getAssetsByIds(ownerId: string, ids: string[]) {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.db
      .prepare(`SELECT * FROM media_assets WHERE owner_id = ? AND id IN (${placeholders})`)
      .all(ownerId, ...ids) as Row[];
    return rows.map(toAsset);
  }

  async createAsset(ownerId: string, asset: NewAsset) {
    this.db
      .prepare(
        `INSERT INTO media_assets (id, owner_id, project_id, kind, role, original_name, storage_key, thumbnail_key,
          mime_type, size_bytes, duration_ms, width, height, has_audio, sha256, origin, rights_confirmed, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        asset.id,
        ownerId,
        asset.projectId,
        asset.kind,
        asset.role,
        asset.originalName,
        asset.storageKey,
        asset.thumbnailKey,
        asset.mimeType,
        asset.sizeBytes,
        asset.durationMs,
        asset.width,
        asset.height,
        asset.hasAudio ? 1 : 0,
        asset.sha256,
        asset.origin,
        asset.rightsConfirmed ? 1 : 0,
        asset.isDemo ? 1 : 0,
        now(),
      );
    if (asset.projectId) {
      this.db.prepare("UPDATE projects SET updated_at = ? WHERE id = ? AND owner_id = ?").run(now(), asset.projectId, ownerId);
    }
    return (await this.getAsset(ownerId, asset.id))!;
  }

  async deleteAsset(ownerId: string, id: string) {
    const result = this.db.prepare("DELETE FROM media_assets WHERE id = ? AND owner_id = ?").run(id, ownerId);
    return result.changes > 0;
  }

  // ---------- Jobs (usuário) ----------

  async createJob(ownerId: string, job: NewJob) {
    return this.transaction(() => {
      const existing = this.db
        .prepare("SELECT * FROM jobs WHERE owner_id = ? AND idempotency_key = ?")
        .get(ownerId, job.idempotencyKey) as Row | undefined;
      if (existing) return { job: toJob(existing), created: false };
      const ts = now();
      this.db
        .prepare(
          `INSERT INTO jobs (id, owner_id, project_id, type, status, provider_id, input, max_attempts,
            idempotency_key, cost_estimate_cents, run_after, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          job.id,
          ownerId,
          job.projectId,
          job.type,
          job.providerId,
          json(job.input),
          job.maxAttempts,
          job.idempotencyKey,
          job.costEstimateCents,
          ts,
          ts,
          ts,
        );
      const row = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(job.id) as Row;
      return { job: toJob(row), created: true };
    }, "IMMEDIATE");
  }

  async getJob(ownerId: string, id: string) {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id = ? AND owner_id = ?").get(id, ownerId) as Row | undefined;
    return row ? toJob(row) : null;
  }

  async listJobs(
    ownerId: string,
    filter: { projectId?: string; statuses?: Job["status"][]; type?: Job["type"]; limit?: number } = {},
  ) {
    const where = ["owner_id = ?"];
    const values: SQLInputValue[] = [ownerId];
    if (filter.projectId) {
      where.push("project_id = ?");
      values.push(filter.projectId);
    }
    if (filter.type) {
      where.push("type = ?");
      values.push(filter.type);
    }
    if (filter.statuses?.length) {
      where.push(`status IN (${filter.statuses.map(() => "?").join(", ")})`);
      values.push(...filter.statuses);
    }
    const rows = this.db
      .prepare(`SELECT * FROM jobs WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ?`)
      .all(...values, filter.limit ?? 50) as Row[];
    return rows.map(toJob);
  }

  async requestJobCancel(ownerId: string, id: string) {
    const ts = now();
    return this.transaction(() => {
      const row = this.db.prepare("SELECT * FROM jobs WHERE id = ? AND owner_id = ?").get(id, ownerId) as Row | undefined;
      if (!row) return null;
      if (row.status === "queued") {
        this.db
          .prepare("UPDATE jobs SET status = 'canceled', cancel_requested = 1, finished_at = ?, updated_at = ? WHERE id = ?")
          .run(ts, ts, id);
      } else if (row.status === "running") {
        this.db.prepare("UPDATE jobs SET cancel_requested = 1, updated_at = ? WHERE id = ?").run(ts, id);
      }
      return toJob(this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Row);
    }, "IMMEDIATE");
  }

  // ---------- Versões e uso ----------

  async listVersions(ownerId: string, projectId: string) {
    const rows = this.db
      .prepare("SELECT * FROM project_versions WHERE owner_id = ? AND project_id = ? ORDER BY number DESC")
      .all(ownerId, projectId) as Row[];
    return rows.map(toVersion);
  }

  async createVersion(
    ownerId: string,
    data: { id: string; projectId: string; renderAssetId: string; timeline: Timeline },
  ) {
    return this.transaction(() => {
      const row = this.db
        .prepare("SELECT COALESCE(MAX(number), 0) + 1 AS next FROM project_versions WHERE project_id = ?")
        .get(data.projectId) as Row;
      this.db
        .prepare(
          "INSERT INTO project_versions (id, owner_id, project_id, number, render_asset_id, timeline, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(data.id, ownerId, data.projectId, Number(row.next), data.renderAssetId, json(data.timeline), now());
      return toVersion(this.db.prepare("SELECT * FROM project_versions WHERE id = ?").get(data.id) as Row);
    }, "IMMEDIATE");
  }

  async recordUsage(ownerId: string, event: Omit<UsageEvent, "ownerId" | "createdAt">) {
    this.db
      .prepare(
        `INSERT INTO usage_events (id, owner_id, job_id, provider_id, kind, cost_cents, idempotency_key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (idempotency_key) DO NOTHING`,
      )
      .run(event.id, ownerId, event.jobId, event.providerId, event.kind, event.costCents, event.idempotencyKey, now());
  }

  async listUsage(ownerId: string, options: { since?: string; limit?: number } = {}) {
    const rows = this.db
      .prepare(
        `SELECT * FROM usage_events WHERE owner_id = ? ${options.since ? "AND created_at >= ?" : ""}
         ORDER BY created_at DESC LIMIT ?`,
      )
      .all(...([ownerId, ...(options.since ? [options.since] : []), options.limit ?? 500] as SQLInputValue[])) as Row[];
    return rows.map(
      (row): UsageEvent => ({
        id: String(row.id),
        ownerId: String(row.owner_id),
        jobId: row.job_id === null ? null : String(row.job_id),
        providerId: String(row.provider_id),
        kind: String(row.kind),
        costCents: Number(row.cost_cents),
        idempotencyKey: String(row.idempotency_key),
        createdAt: String(row.created_at),
      }),
    );
  }

  // ---------- Jobs (worker) ----------

  async claimNextJob(workerId: string, leaseMs: number) {
    return this.transaction(() => {
      const ts = now();
      const row = this.db
        .prepare("SELECT id FROM jobs WHERE status = 'queued' AND run_after <= ? ORDER BY created_at LIMIT 1")
        .get(ts) as Row | undefined;
      if (!row) return null;
      const lockedUntil = new Date(Date.now() + leaseMs).toISOString();
      this.db
        .prepare(
          `UPDATE jobs SET status = 'running', attempts = attempts + 1, locked_by = ?, locked_until = ?,
             started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ? AND status = 'queued'`,
        )
        .run(workerId, lockedUntil, ts, ts, row.id);
      return toJob(this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(row.id) as Row);
    }, "IMMEDIATE");
  }

  async extendLease(jobId: string, workerId: string, leaseMs: number) {
    const lockedUntil = new Date(Date.now() + leaseMs).toISOString();
    this.db
      .prepare("UPDATE jobs SET locked_until = ?, updated_at = ? WHERE id = ? AND locked_by = ? AND status = 'running'")
      .run(lockedUntil, now(), jobId, workerId);
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
    const sets: string[] = [];
    const values: SQLInputValue[] = [];
    for (const [key, value] of Object.entries(patch) as [keyof JobPatch, unknown][]) {
      if (value === undefined) continue;
      sets.push(`${columns[key]} = ?`);
      values.push(key === "output" ? json(value) : (value as SQLInputValue));
    }
    sets.push("updated_at = ?");
    values.push(now());
    this.db.prepare(`UPDATE jobs SET ${sets.join(", ")} WHERE id = ?`).run(...values, jobId);
    return this.getJobById(jobId);
  }

  async getJobById(jobId: string) {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as Row | undefined;
    return row ? toJob(row) : null;
  }

  async recoverExpiredJobs() {
    return this.transaction(() => {
      const ts = now();
      const failed = this.db
        .prepare(
          `UPDATE jobs SET status = 'failed', error = 'Tempo de processamento excedido após várias tentativas.',
             finished_at = ?, locked_by = NULL, locked_until = NULL, updated_at = ?
           WHERE status = 'running' AND locked_until < ? AND attempts >= max_attempts`,
        )
        .run(ts, ts, ts);
      const requeued = this.db
        .prepare(
          `UPDATE jobs SET status = 'queued', run_after = ?, locked_by = NULL, locked_until = NULL, updated_at = ?
           WHERE status = 'running' AND locked_until < ? AND attempts < max_attempts`,
        )
        .run(ts, ts, ts);
      return { requeued: Number(requeued.changes), failed: Number(failed.changes) };
    }, "IMMEDIATE");
  }
}
