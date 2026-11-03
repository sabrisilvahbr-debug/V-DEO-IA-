/**
 * Esquema do banco local (SQLite). Espelha as migrações do Supabase em
 * `supabase/migrations/`. Cada entrada é aplicada uma única vez, em ordem.
 */
export const sqliteMigrations: string[] = [
  `
  CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL CHECK (aspect_ratio IN ('16:9','9:16','1:1')),
    timeline TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX projects_owner_updated ON projects (owner_id, updated_at DESC);

  CREATE TABLE media_assets (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    kind TEXT NOT NULL CHECK (kind IN ('video','image','audio')),
    role TEXT NOT NULL CHECK (role IN ('source','reference','generated','render')),
    original_name TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    thumbnail_key TEXT,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    duration_ms INTEGER,
    width INTEGER,
    height INTEGER,
    has_audio INTEGER NOT NULL DEFAULT 0,
    sha256 TEXT NOT NULL,
    origin TEXT,
    rights_confirmed INTEGER NOT NULL DEFAULT 0,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX media_assets_owner_project ON media_assets (owner_id, project_id, created_at DESC);

  CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('generation','render','scene_detect')),
    status TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','canceled')),
    provider_id TEXT,
    provider_job_id TEXT,
    input TEXT NOT NULL,
    output TEXT,
    error TEXT,
    progress REAL NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    idempotency_key TEXT NOT NULL,
    cancel_requested INTEGER NOT NULL DEFAULT 0,
    cost_estimate_cents INTEGER,
    run_after TEXT NOT NULL,
    locked_until TEXT,
    locked_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    UNIQUE (owner_id, idempotency_key)
  );
  CREATE INDEX jobs_queue ON jobs (status, run_after);
  CREATE INDEX jobs_owner_project ON jobs (owner_id, project_id, created_at DESC);

  CREATE TABLE project_versions (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    render_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    timeline TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (project_id, number)
  );

  CREATE TABLE usage_events (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    job_id TEXT,
    provider_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    cost_cents INTEGER NOT NULL DEFAULT 0,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );
  CREATE INDEX usage_events_owner_created ON usage_events (owner_id, created_at DESC);
  `,
];
