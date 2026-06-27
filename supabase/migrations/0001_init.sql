-- pobi backend — initial schema (Phase 1 + scaffolding for Phase 2/3)
-- Multi-user: Google sign-in via Supabase Auth. Every per-user table is
-- protected by Row-Level Security so a user can only touch their own rows.
-- Paste this whole file into Supabase → SQL Editor → Run.

-- ---------------------------------------------------------------------------
-- profiles: one row per signed-in user (for cross-device identity + community)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  handle       text unique,                       -- @name for community (phase 3)
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- item_state: per-user, per-item interaction. Covers readIds / openedIds /
-- starredIds / savedIds / dismissedIds AND the finished knowledge-graph
-- snapshot (title/url/topics/... live in `snapshot` jsonb so the graph
-- survives feed turnover). One row per (user, feed-item).
-- item_id is pobi's stable "channel:sourceId" id.
-- ---------------------------------------------------------------------------
create table if not exists public.item_state (
  user_id     uuid not null references auth.users(id) on delete cascade,
  item_id     text not null,
  read        boolean not null default false,
  opened      boolean not null default false,
  starred     boolean not null default false,
  saved       boolean not null default false,   -- 待读清单
  dismissed   boolean not null default false,
  finished_at timestamptz,                       -- when 确认读完
  takeaway    text,                              -- user note for the graph
  snapshot    jsonb,                             -- FinishedNote metadata, null until finished
  updated_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index if not exists item_state_user_finished_idx
  on public.item_state (user_id, finished_at desc) where finished_at is not null;

-- ---------------------------------------------------------------------------
-- user_stats: habit aggregates (date-keyed). readStat = per-day per-source
-- counts; click_log = per-day 跳转原文 counts. Kept as jsonb for now.
-- ---------------------------------------------------------------------------
create table if not exists public.user_stats (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  read_stat  jsonb not null default '{}'::jsonb,
  click_log  jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- user_prefs: onboarding prefs (interests/sectors, reading-time budget),
-- plus misc client flags (lastSeenAt, papersSeeded, watchlist).
-- ---------------------------------------------------------------------------
create table if not exists public.user_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- PHASE 2 scaffolding — per-user source subscriptions + curated topic bundles
-- ---------------------------------------------------------------------------
-- Master catalog of every source the builder polls (mirrors src/data/*.json;
-- user-added sources land here so the global crawl picks them up).
create table if not exists public.source_catalog (
  source_key text primary key,            -- = sourceKeyOf(item) (handle / ticker / url)
  channel    text not null,
  name       text,                        -- Chinese display name
  en_name    text,
  handle     text,                        -- X handle / RSS url / arXiv author
  sectors    text[] not null default '{}',
  added_by   uuid references auth.users(id) on delete set null,
  status     text not null default 'active',  -- active | retired
  created_at timestamptz not null default now()
);

-- Per-user subscription state over the catalog.
create table if not exists public.subscriptions (
  user_id    uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  status     text not null default 'active',   -- active | paused | removed
  rename     text,                              -- per-user display override
  updated_at timestamptz not null default now(),
  primary key (user_id, source_key)
);

-- Curated topic bundles for 一键follow.
create table if not exists public.topic_bundles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  source_keys text[] not null default '{}',
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create table if not exists public.bundle_follows (
  user_id    uuid not null references auth.users(id) on delete cascade,
  bundle_id  uuid not null references public.topic_bundles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, bundle_id)
);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.item_state     enable row level security;
alter table public.user_stats     enable row level security;
alter table public.user_prefs     enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.bundle_follows enable row level security;
alter table public.source_catalog enable row level security;
alter table public.topic_bundles  enable row level security;

-- profiles: anyone signed-in can read (for community); only owner writes.
create policy "profiles read"   on public.profiles for select using (true);
create policy "profiles write"  on public.profiles for update using (auth.uid() = id);
create policy "profiles insert" on public.profiles for insert with check (auth.uid() = id);

-- owner-only tables: full CRUD on your own rows.
create policy "own item_state"    on public.item_state    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own user_stats"    on public.user_stats    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own user_prefs"    on public.user_prefs    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own subscriptions" on public.subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own bundle_follows" on public.bundle_follows for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- shared, read-only-to-users catalog + bundles (writes happen via service role / admin).
create policy "catalog read" on public.source_catalog for select using (true);
create policy "bundles read" on public.topic_bundles  for select using (true);
-- users may add a source to the shared catalog (builder then polls it).
create policy "catalog add"  on public.source_catalog for insert with check (auth.uid() = added_by);
