-- =====================================================================
-- Hack EX2 Upgrade Tracker — schema, validation and Row Level Security
-- Run this whole file once in Supabase: Dashboard → SQL Editor → New query → Run.
-- Then run 0002_seed.sql.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Upgrade catalog (read-only for players; change it here in SQL)
-- ---------------------------------------------------------------------
create table if not exists public.upgrade_catalog (
  id                 text primary key,
  name               text not null,
  category           text not null check (category in ('core','defensive','offensive','virus','utility','one_time')),
  kind               text not null check (kind in ('level','one_time')),
  start_level        int  not null check (start_level >= 0),
  max_level          int  check (max_level is null or max_level >= start_level),   -- null = no known cap
  store              boolean not null,
  download           boolean not null,
  defensive_discount boolean not null default false,
  active             boolean not null default true,
  sort_order         int not null default 0
);

-- ---------------------------------------------------------------------
-- Admins (add yourself with: insert into public.app_admins values ('<your user id>');)
-- ---------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- Shared research: raw observations. Never overwritten by formulas.
-- ---------------------------------------------------------------------
create table if not exists public.price_observations (
  id               uuid primary key default gen_random_uuid(),
  upgrade_id       text not null references public.upgrade_catalog(id),
  method           text not null check (method in ('store','download')),
  from_level       int  not null check (from_level >= 0),
  to_level         int  not null check (to_level > from_level),
  cost             bigint not null check (cost >= 0 and cost < 1000000000000000),
  cost_type        text not null check (cost_type in ('per_level','combined','component','one_time')),
  price_basis      text not null default 'final' check (price_basis in ('final','before_discount')),
  keygen_level     int  check (keygen_level is null or keygen_level >= 0),
  contributor_id   uuid references auth.users(id) on delete set null default auth.uid(),
  contributor_alias text check (char_length(contributor_alias) <= 40),
  created_at       timestamptz not null default now(),
  status           text not null default 'observed' check (status in ('observed','confirmed','rejected')),
  notes            text not null default '' check (char_length(notes) <= 500),
  purchase_id      uuid,
  constraint price_shape check (
    (cost_type in ('per_level','component') and to_level = from_level + 1) or
    (cost_type = 'one_time' and from_level = 0 and to_level = 1 and method = 'store') or
    (cost_type = 'combined' and method = 'download')
  ),
  constraint price_method_type check (
    (method = 'store' and cost_type in ('per_level','one_time')) or
    (method = 'download' and cost_type in ('combined','component'))
  )
);

create table if not exists public.exp_observations (
  id               uuid primary key default gen_random_uuid(),
  upgrade_id       text not null references public.upgrade_catalog(id),
  method           text not null check (method in ('store','download')),
  from_level       int  not null check (from_level >= 0),
  to_level         int  not null check (to_level > from_level),
  exp              bigint not null check (exp >= 0 and exp < 1000000000000),
  exp_basis        text not null check (exp_basis in ('per_level','per_transaction')),
  source           text not null check (source in ('entered','inferred','derived')),
  contributor_id   uuid references auth.users(id) on delete set null default auth.uid(),
  contributor_alias text check (char_length(contributor_alias) <= 40),
  created_at       timestamptz not null default now(),
  status           text not null default 'observed' check (status in ('observed','confirmed','rejected')),
  notes            text not null default '' check (char_length(notes) <= 500),
  purchase_id      uuid,
  constraint exp_shape check (exp_basis = 'per_transaction' or to_level = from_level + 1)
);

create table if not exists public.level_requirement_observations (
  id               uuid primary key default gen_random_uuid(),
  level            int not null check (level >= 1 and level <= 100000),
  exp_required     bigint not null check (exp_required > 0 and exp_required < 1000000000000),
  contributor_id   uuid references auth.users(id) on delete set null default auth.uid(),
  contributor_alias text check (char_length(contributor_alias) <= 40),
  created_at       timestamptz not null default now(),
  status           text not null default 'observed' check (status in ('observed','confirmed','rejected')),
  notes            text not null default '' check (char_length(notes) <= 500)
);

create table if not exists public.observation_flags (
  id              uuid primary key default gen_random_uuid(),
  observation_type text not null check (observation_type in ('price','exp','level_req')),
  observation_id  uuid not null,
  reason          text not null check (char_length(reason) between 1 and 500),
  flagged_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  resolved        boolean not null default false
);

create index if not exists price_obs_lookup on public.price_observations (upgrade_id, method, to_level);
create index if not exists exp_obs_lookup   on public.exp_observations (upgrade_id, method, to_level);
create index if not exists req_obs_lookup   on public.level_requirement_observations (level);

-- Server-side rules the catalog imposes on observations (method allowed, cap respected).
create or replace function public.check_observation_against_catalog() returns trigger
language plpgsql set search_path = public as $$
declare c public.upgrade_catalog;
begin
  select * into c from public.upgrade_catalog where id = new.upgrade_id;
  if not found then raise exception 'Unknown upgrade %', new.upgrade_id; end if;
  if new.method = 'download' and not c.download then
    raise exception '% cannot be downloaded', c.name;
  end if;
  if new.method = 'store' and not c.store then
    raise exception '% is not sold in the store', c.name;
  end if;
  if c.max_level is not null and new.to_level > c.max_level then
    raise exception '% maxes out at level %', c.name, c.max_level;
  end if;
  if c.kind = 'one_time' and not (new.from_level = 0 and new.to_level = 1) then
    raise exception '% is a one-time purchase', c.name;
  end if;
  return new;
end $$;

drop trigger if exists price_obs_catalog on public.price_observations;
create trigger price_obs_catalog before insert or update on public.price_observations
  for each row execute function public.check_observation_against_catalog();
drop trigger if exists exp_obs_catalog on public.exp_observations;
create trigger exp_obs_catalog before insert or update on public.exp_observations
  for each row execute function public.check_observation_against_catalog();

-- ---------------------------------------------------------------------
-- Personal data: only the owner can see or change it.
-- ---------------------------------------------------------------------
create table if not exists public.player_profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  alias      text not null default '' check (char_length(alias) <= 40),
  created_at timestamptz not null default now()
);

create table if not exists public.player_progress (
  user_id        uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  level          int not null check (level >= 1),
  exp            bigint not null check (exp >= 0),
  required       bigint check (required is null or (required > 0 and exp < required)),
  setup_complete boolean not null default false,
  updated_at     timestamptz not null default now()
);

create table if not exists public.player_upgrade_state (
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  upgrade_id text not null references public.upgrade_catalog(id),
  level      int  not null check (level >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, upgrade_id)
);

create or replace function public.check_player_level() returns trigger
language plpgsql set search_path = public as $$
declare c public.upgrade_catalog;
begin
  select * into c from public.upgrade_catalog where id = new.upgrade_id;
  if c.max_level is not null and new.level > c.max_level then
    raise exception '% maxes out at level %', c.name, c.max_level;
  end if;
  return new;
end $$;
drop trigger if exists player_level_cap on public.player_upgrade_state;
create trigger player_level_cap before insert or update on public.player_upgrade_state
  for each row execute function public.check_player_level();

create table if not exists public.purchase_history (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  upgrade_id     text not null references public.upgrade_catalog(id),
  method         text not null check (method in ('store','download')),
  from_level     int not null check (from_level >= 0),
  to_level       int not null check (to_level > from_level),
  keygen_level   int,
  cost           bigint check (cost is null or cost >= 0),
  cost_source    text not null check (cost_source in ('observed','entered','estimate','missing')),
  exp_earned     bigint,
  exp_expected   bigint,
  before_level   int not null, before_exp bigint not null, before_required bigint,
  after_level    int not null, after_exp  bigint not null, after_required  bigint,
  confidence     text not null check (confidence in ('exact','uses_unverified','incomplete','estimate')),
  data_sources   jsonb not null default '[]'::jsonb,
  notes          text not null default '' check (char_length(notes) <= 500),
  created_at     timestamptz not null default now()
);
create index if not exists purchase_history_user on public.purchase_history (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.upgrade_catalog                enable row level security;
alter table public.app_admins                     enable row level security;
alter table public.price_observations             enable row level security;
alter table public.exp_observations               enable row level security;
alter table public.level_requirement_observations enable row level security;
alter table public.observation_flags              enable row level security;
alter table public.player_profiles                enable row level security;
alter table public.player_progress                enable row level security;
alter table public.player_upgrade_state           enable row level security;
alter table public.purchase_history               enable row level security;

-- Catalog: everyone can read, nobody writes through the API.
drop policy if exists catalog_read on public.upgrade_catalog;
create policy catalog_read on public.upgrade_catalog for select to anon, authenticated using (true);

-- Admin list: an admin can see it (used to show moderation tools).
drop policy if exists admins_read on public.app_admins;
create policy admins_read on public.app_admins for select to authenticated using (user_id = auth.uid() or public.is_admin());

-- Observations: anyone can read; signed-in players add their own as "observed";
-- only admins can change status or correct a row. Nobody deletes through the API.
do $$
declare t text;
begin
  foreach t in array array['price_observations','exp_observations','level_requirement_observations'] loop
    execute format('drop policy if exists obs_read on public.%I', t);
    execute format('create policy obs_read on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists obs_insert on public.%I', t);
    execute format($p$create policy obs_insert on public.%I for insert to authenticated
                     with check (contributor_id = auth.uid() and status = 'observed')$p$, t);
    execute format('drop policy if exists obs_admin_update on public.%I', t);
    execute format('create policy obs_admin_update on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

drop policy if exists flags_read on public.observation_flags;
create policy flags_read on public.observation_flags for select to authenticated using (true);
drop policy if exists flags_insert on public.observation_flags;
create policy flags_insert on public.observation_flags for insert to authenticated
  with check (flagged_by = auth.uid() and resolved = false);
drop policy if exists flags_admin_update on public.observation_flags;
create policy flags_admin_update on public.observation_flags for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Personal tables: owner only, for every operation.
do $$
declare t text;
begin
  foreach t in array array['player_profiles','player_progress','player_upgrade_state','purchase_history'] loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Table privileges (RLS above still decides which rows). Start from nothing, then grant.
revoke all on public.upgrade_catalog, public.app_admins, public.price_observations, public.exp_observations,
  public.level_requirement_observations, public.observation_flags, public.player_profiles,
  public.player_progress, public.player_upgrade_state, public.purchase_history from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.upgrade_catalog, public.price_observations, public.exp_observations,
  public.level_requirement_observations to anon, authenticated;
grant insert on public.price_observations, public.exp_observations,
  public.level_requirement_observations, public.observation_flags to authenticated;
grant update (status, notes) on public.price_observations, public.exp_observations,
  public.level_requirement_observations to authenticated;
grant select on public.observation_flags, public.app_admins to authenticated;
grant update (resolved) on public.observation_flags to authenticated;
grant select, insert, update, delete on public.player_profiles, public.player_progress,
  public.player_upgrade_state, public.purchase_history to authenticated;
