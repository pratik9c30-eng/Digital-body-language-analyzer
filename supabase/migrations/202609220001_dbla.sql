create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calibration (
  user_id uuid primary key references auth.users(id) on delete cascade,
  typing_count integer not null default 0 check (typing_count >= 0),
  mouse_count integer not null default 0 check (mouse_count >= 0),
  scroll_count integer not null default 0 check (scroll_count >= 0),
  minimum_per_behavior integer not null default 10 check (minimum_per_behavior > 0),
  completed boolean generated always as (
    typing_count >= minimum_per_behavior
    and mouse_count >= minimum_per_behavior
    and scroll_count >= minimum_per_behavior
  ) stored,
  updated_at timestamptz not null default now()
);

create table if not exists public.behavior_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  behavior_type text not null check (behavior_type in ('typing', 'mouse', 'scroll')),
  derived_metrics jsonb not null check (
    jsonb_typeof(derived_metrics) = 'object'
    and not (derived_metrics ?| array['text', 'key', 'code', 'character', 'keyCode', 'x', 'y', 'clientX', 'clientY', 'pageX', 'pageY', 'coordinates', 'path'])
    and pg_column_size(derived_metrics) <= 4096
  ),
  created_at timestamptz not null default now()
);

create table if not exists public.baselines (
  user_id uuid primary key references auth.users(id) on delete cascade,
  metrics jsonb not null check (
    jsonb_typeof(metrics) = 'object'
    and not (metrics ?| array['text', 'key', 'code', 'character', 'keyCode', 'x', 'y', 'clientX', 'clientY', 'pageX', 'pageY', 'coordinates', 'path'])
    and pg_column_size(metrics) <= 16384
  ),
  sample_count integer not null default 0 check (sample_count >= 0),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insight_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metrics jsonb not null check (
    jsonb_typeof(metrics) = 'object'
    and not (metrics ?| array['text', 'key', 'code', 'character', 'keyCode', 'x', 'y', 'clientX', 'clientY', 'pageX', 'pageY', 'coordinates', 'path'])
    and pg_column_size(metrics) <= 4096
  ),
  deltas jsonb not null default '{}'::jsonb check (
    jsonb_typeof(deltas) = 'object'
    and not (deltas ?| array['text', 'key', 'code', 'character', 'keyCode', 'x', 'y', 'clientX', 'clientY', 'pageX', 'pageY', 'coordinates', 'path'])
    and pg_column_size(deltas) <= 4096
  ),
  pattern jsonb not null default '{}'::jsonb check (
    jsonb_typeof(pattern) = 'object'
    and not (pattern ?| array['text', 'key', 'code', 'character', 'keyCode', 'x', 'y', 'clientX', 'clientY', 'pageX', 'pageY', 'coordinates', 'path'])
    and pg_column_size(pattern) <= 4096
  ),
  behavior_match numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device text not null default 'Unknown device',
  browser text not null default 'Unknown browser',
  created_at timestamptz not null default now()
);

-- Model artifacts are server-only. The Python service stores a validated,
-- JSON-serializable model state here; clients have no RLS policies on it.
create table if not exists public.model_artifacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  model_version text not null default 'dbla-v1',
  model_state jsonb not null check (
    jsonb_typeof(model_state) = 'object'
    and not (model_state ?| array['text', 'key', 'code', 'character', 'keyCode', 'x', 'y', 'clientX', 'clientY', 'pageX', 'pageY', 'coordinates', 'path'])
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists behavior_samples_user_created_idx
  on public.behavior_samples (user_id, created_at desc);
create index if not exists insight_snapshots_user_created_idx
  on public.insight_snapshots (user_id, created_at desc);
create index if not exists login_events_user_created_idx
  on public.login_events (user_id, created_at desc);
alter table public.profiles enable row level security;
alter table public.calibration enable row level security;
alter table public.behavior_samples enable row level security;
alter table public.baselines enable row level security;
alter table public.insight_snapshots enable row level security;
alter table public.login_events enable row level security;
alter table public.model_artifacts enable row level security;

revoke all on table public.profiles, public.calibration, public.behavior_samples,
  public.baselines, public.insight_snapshots, public.login_events,
  public.model_artifacts from anon, authenticated;
grant select on table public.behavior_samples, public.baselines, public.login_events
  to authenticated;

-- Client-readable data. All writes remain server-only through the secret key.
drop policy if exists "users can read own behavior samples" on public.behavior_samples;
create policy "users can read own behavior samples"
  on public.behavior_samples for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "users can read own baselines" on public.baselines;
create policy "users can read own baselines"
  on public.baselines for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "users can read own login events" on public.login_events;
create policy "users can read own login events"
  on public.login_events for select
  to authenticated
  using (user_id = (select auth.uid()));

-- There are intentionally no client policies for profiles, calibration,
-- insight_snapshots, or model_artifacts. The Python server owns their writes
-- and reads through the Supabase secret key.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 80), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists calibration_set_updated_at on public.calibration;
create trigger calibration_set_updated_at
before update on public.calibration
for each row execute function public.set_updated_at();

drop trigger if exists baselines_set_updated_at on public.baselines;
create trigger baselines_set_updated_at
before update on public.baselines
for each row execute function public.set_updated_at();

drop trigger if exists model_artifacts_set_updated_at on public.model_artifacts;
create trigger model_artifacts_set_updated_at
before update on public.model_artifacts
for each row execute function public.set_updated_at();
