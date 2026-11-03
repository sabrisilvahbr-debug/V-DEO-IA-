-- CINEMORPH AI — esquema inicial (espelha lib/server/store/sqlite-schema.ts)
-- Todas as tabelas têm RLS: cada usuário só acessa as próprias linhas.
-- O worker usa a chave secreta (service role), que ignora RLS e filtra pelo owner_id no código.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: dono lê" on public.profiles
  for select using ((select auth.uid()) = id);
create policy "profiles: dono atualiza" on public.profiles
  for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- projects
create table public.projects (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  aspect_ratio text not null check (aspect_ratio in ('16:9', '9:16', '1:1')),
  timeline jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_updated on public.projects (owner_id, updated_at desc);

alter table public.projects enable row level security;
create policy "projects: dono lê" on public.projects for select using ((select auth.uid()) = owner_id);
create policy "projects: dono cria" on public.projects for insert with check ((select auth.uid()) = owner_id);
create policy "projects: dono atualiza" on public.projects for update
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "projects: dono exclui" on public.projects for delete using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------- media_assets
create table public.media_assets (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id text references public.projects (id) on delete set null,
  kind text not null check (kind in ('video', 'image', 'audio')),
  role text not null check (role in ('source', 'reference', 'generated', 'render')),
  original_name text not null,
  storage_key text not null,
  thumbnail_key text,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  duration_ms integer,
  width integer,
  height integer,
  has_audio boolean not null default false,
  sha256 text not null,
  origin text,
  rights_confirmed boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index media_assets_owner_project on public.media_assets (owner_id, project_id, created_at desc);

alter table public.media_assets enable row level security;
create policy "media: dono lê" on public.media_assets for select using ((select auth.uid()) = owner_id);
create policy "media: dono cria" on public.media_assets for insert with check ((select auth.uid()) = owner_id);
create policy "media: dono exclui" on public.media_assets for delete using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------- jobs
-- Tabela única para gerações, renderizações e detecção de cenas (coluna "type").
create table public.jobs (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id text references public.projects (id) on delete cascade,
  type text not null check (type in ('generation', 'render', 'scene_detect')),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'canceled')),
  provider_id text,
  provider_job_id text,
  input jsonb not null,
  output jsonb,
  error text,
  progress real not null default 0,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  idempotency_key text not null,
  cancel_requested boolean not null default false,
  cost_estimate_cents integer,
  run_after timestamptz not null default now(),
  locked_until timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  unique (owner_id, idempotency_key)
);
create index jobs_queue on public.jobs (status, run_after);
create index jobs_owner_project on public.jobs (owner_id, project_id, created_at desc);

alter table public.jobs enable row level security;
create policy "jobs: dono lê" on public.jobs for select using ((select auth.uid()) = owner_id);
-- Usuário só cria jobs na fila; status, saída e lease são escritos pelo worker.
create policy "jobs: dono cria na fila" on public.jobs for insert
  with check ((select auth.uid()) = owner_id and status = 'queued' and attempts = 0);

-- Cancelamento pelo usuário passa por função para não permitir alterar outras colunas.
create function public.request_job_cancel(p_job_id text) returns public.jobs
language plpgsql security definer set search_path = '' as $$
declare
  result public.jobs;
begin
  update public.jobs
     set cancel_requested = true,
         status = case when status = 'queued' then 'canceled' else status end,
         finished_at = case when status = 'queued' then now() else finished_at end,
         updated_at = now()
   where id = p_job_id and owner_id = auth.uid()
   returning * into result;
  return result;
end;
$$;

-- Reserva atômica do próximo job (somente service role).
create function public.claim_next_job(p_worker text, p_lease_seconds integer) returns setof public.jobs
language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.jobs j
     set status = 'running',
         attempts = j.attempts + 1,
         locked_by = p_worker,
         locked_until = now() + make_interval(secs => p_lease_seconds),
         started_at = coalesce(j.started_at, now()),
         updated_at = now()
   where j.id = (
     select id from public.jobs
      where status = 'queued' and run_after <= now()
      order by created_at
      for update skip locked
      limit 1
   )
  returning j.*;
end;
$$;

create function public.recover_expired_jobs() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  failed_count integer;
  requeued_count integer;
begin
  update public.jobs
     set status = 'failed', error = 'Tempo de processamento excedido após várias tentativas.',
         finished_at = now(), locked_by = null, locked_until = null, updated_at = now()
   where status = 'running' and locked_until < now() and attempts >= max_attempts;
  get diagnostics failed_count = row_count;

  update public.jobs
     set status = 'queued', run_after = now(), locked_by = null, locked_until = null, updated_at = now()
   where status = 'running' and locked_until < now() and attempts < max_attempts;
  get diagnostics requeued_count = row_count;

  return jsonb_build_object('failed', failed_count, 'requeued', requeued_count);
end;
$$;

revoke execute on function public.claim_next_job(text, integer) from public, anon, authenticated;
revoke execute on function public.recover_expired_jobs() from public, anon, authenticated;
grant execute on function public.claim_next_job(text, integer) to service_role;
grant execute on function public.recover_expired_jobs() to service_role;
revoke execute on function public.request_job_cancel(text) from public, anon;
grant execute on function public.request_job_cancel(text) to authenticated;

-- ---------------------------------------------------------------- project_versions
create table public.project_versions (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  project_id text not null references public.projects (id) on delete cascade,
  number integer not null,
  render_asset_id text not null references public.media_assets (id) on delete cascade,
  timeline jsonb not null,
  created_at timestamptz not null default now(),
  unique (project_id, number)
);

alter table public.project_versions enable row level security;
create policy "versions: dono lê" on public.project_versions for select using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------- usage_events
create table public.usage_events (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  job_id text,
  provider_id text not null,
  kind text not null,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index usage_events_owner_created on public.usage_events (owner_id, created_at desc);

alter table public.usage_events enable row level security;
create policy "usage: dono lê" on public.usage_events for select using ((select auth.uid()) = owner_id);

-- ---------------------------------------------------------------- storage
-- Bucket privado. Arquivos ficam em <owner_id>/<asset_id>/...
insert into storage.buckets (id, name, public) values ('media', 'media', false)
  on conflict (id) do nothing;

create policy "storage: dono lê" on storage.objects for select
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "storage: dono envia" on storage.objects for insert
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "storage: dono exclui" on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
