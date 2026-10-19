-- =====================================================================
-- Hack EX2 Upgrade Tracker — schema, validation and Row Level Security
-- Run this whole file once in Supabase: Dashboard → SQL Editor → New query → Run.
-- Then run 0002_seed.sql. Safe to run again after changes.
--
-- Accounts: players sign up with a username + 4-digit PIN. The app turns these into
-- an email "<username>@users.hedb.app" and password "hedb#<PIN>#pin" for Supabase Auth,
-- so Authentication → Email → "Confirm email" must be OFF.
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
  user_id    uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);

-- New accounts wait for the admin to approve them before they can see or add data.
alter table public.player_profiles add column if not exists approved boolean not null default false;

create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.player_profiles where user_id = auth.uid() and approved) or public.is_admin();
$$;

-- A profile is created automatically when an account signs up (username comes from sign-up metadata).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare u text := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
begin
  if u !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username must be 3–20 letters, numbers or _';
  end if;
  insert into public.player_profiles (user_id, username) values (new.id, u);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Observations always show the contributor's real username (it can't be faked by the client).
create or replace function public.stamp_contributor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.contributor_alias := (select username from public.player_profiles where user_id = auth.uid());
  end if;
  return new;
end $$;
drop trigger if exists price_obs_stamp on public.price_observations;
create trigger price_obs_stamp before insert on public.price_observations for each row execute function public.stamp_contributor();
drop trigger if exists exp_obs_stamp on public.exp_observations;
create trigger exp_obs_stamp before insert on public.exp_observations for each row execute function public.stamp_contributor();
drop trigger if exists req_obs_stamp on public.level_requirement_observations;
create trigger req_obs_stamp before insert on public.level_requirement_observations for each row execute function public.stamp_contributor();

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

-- Reboots: the game's R number. Stored with each report so formulas can separate
-- rebooted and non-rebooted players if prices or XP turn out to differ.
alter table public.player_progress add column if not exists reboots int not null default 0 check (reboots >= 0 and reboots < 1000);
alter table public.price_observations add column if not exists reboots int check (reboots is null or (reboots >= 0 and reboots < 1000));
alter table public.exp_observations add column if not exists reboots int check (reboots is null or (reboots >= 0 and reboots < 1000));
alter table public.level_requirement_observations add column if not exists reboots int check (reboots is null or (reboots >= 0 and reboots < 1000));

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

-- Observations: any signed-in player can read; signed-in players add their own as "observed";
-- only admins can change status or correct a row. Nobody deletes through the API.
do $$
declare t text;
begin
  foreach t in array array['price_observations','exp_observations','level_requirement_observations'] loop
    execute format('drop policy if exists obs_read on public.%I', t);
    execute format('create policy obs_read on public.%I for select to authenticated using (public.is_approved())', t);
    execute format('drop policy if exists obs_insert on public.%I', t);
    execute format($p$create policy obs_insert on public.%I for insert to authenticated
                     with check (contributor_id = auth.uid() and status = 'observed' and public.is_approved())$p$, t);
    execute format('drop policy if exists obs_admin_update on public.%I', t);
    execute format('create policy obs_admin_update on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

drop policy if exists flags_read on public.observation_flags;
create policy flags_read on public.observation_flags for select to authenticated using (public.is_approved());
drop policy if exists flags_insert on public.observation_flags;
create policy flags_insert on public.observation_flags for insert to authenticated
  with check (flagged_by = auth.uid() and resolved = false and public.is_approved());
drop policy if exists flags_admin_update on public.observation_flags;
create policy flags_admin_update on public.observation_flags for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Personal tables: owner only, for every operation.
do $$
declare t text;
begin
  foreach t in array array['player_progress','player_upgrade_state','purchase_history'] loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (user_id = auth.uid() and public.is_approved()) with check (user_id = auth.uid() and public.is_approved())', t);
  end loop;
end $$;

-- Profiles: you see your own; the admin sees everyone's (for PIN resets). Created only by the sign-up trigger.
drop policy if exists profile_read on public.player_profiles;
create policy profile_read on public.player_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists owner_all on public.player_profiles;

-- ---------------------------------------------------------------------
-- PIN sign-in helpers
-- ---------------------------------------------------------------------
-- Lockout after 5 wrong PINs for 15 minutes. The app checks this before every sign-in.
-- (Supabase Auth's own rate limits are the second line of defence.)
create table if not exists public.login_attempts (
  username     text primary key,
  failures     int not null default 0,
  locked_until timestamptz
);
alter table public.login_attempts enable row level security;   -- no policies: only the functions below touch it

-- Seconds until this username may try again (0 = not locked).
create or replace function public.login_wait(p_username text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(greatest(0, ceil(extract(epoch from (locked_until - now()))))::int, 0)
  from (select max(locked_until) as locked_until from public.login_attempts where username = lower(p_username)) x;
$$;

-- Records a wrong PIN. Returns how many tries are left before a lockout.
create or replace function public.login_failed(p_username text) returns int
language plpgsql security definer set search_path = public as $$
declare f int;
begin
  if lower(p_username) !~ '^[a-z0-9_]{3,20}$' then return 0; end if;
  insert into public.login_attempts as a (username, failures) values (lower(p_username), 1)
  on conflict (username) do update set failures = case when a.locked_until < now() then 1 else a.failures + 1 end,
                                     locked_until = case when a.locked_until < now() then null else a.locked_until end
  returning failures into f;
  if f >= 5 then
    update public.login_attempts set locked_until = now() + interval '15 minutes', failures = 0 where username = lower(p_username);
    return 0;
  end if;
  return 5 - f;
end $$;

-- Clears the counter after a successful sign-in.
create or replace function public.login_ok() returns void
language sql security definer set search_path = public as $$
  delete from public.login_attempts
  where username = (select username from public.player_profiles where user_id = auth.uid());
$$;

-- Admin: set a new 4-digit PIN for a player who forgot theirs.
create or replace function public.admin_reset_pin(p_user_id uuid, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must be 4 digits'; end if;
  update auth.users set encrypted_password = crypt('hedb#' || p_pin || '#pin', gen_salt('bf')), updated_at = now()
  where id = p_user_id;
  if not found then raise exception 'Player not found'; end if;
  delete from public.login_attempts
  where username = (select username from public.player_profiles where user_id = p_user_id);
end $$;

-- Admin: approve (or un-approve) a player.
create or replace function public.admin_set_approved(p_user_id uuid, p_approved boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.player_profiles set approved = p_approved where user_id = p_user_id;
  if not found then raise exception 'Player not found'; end if;
end $$;

-- Admin: change a player's username (also their sign-in name). Their PIN doesn't change.
-- Earlier reports they shared are relabelled so everything stays linked to them.
create or replace function public.admin_rename(p_user_id uuid, p_username text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare u text := lower(trim(p_username)); old text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if u !~ '^[a-z0-9_]{3,20}$' then raise exception 'Username must be 3–20 letters, numbers or _'; end if;
  select username into old from public.player_profiles where user_id = p_user_id;
  if not found then raise exception 'Player not found'; end if;
  if u = old then return; end if;
  if exists (select 1 from public.player_profiles where username = u) then raise exception 'That username is taken'; end if;
  update public.player_profiles set username = u where user_id = p_user_id;
  update auth.users set email = u || '@users.hedb.app',
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('username', u), updated_at = now()
    where id = p_user_id;
  update auth.identities set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', u || '@users.hedb.app')
    where user_id = p_user_id and provider = 'email';
  update public.price_observations set contributor_alias = u where contributor_id = p_user_id;
  update public.exp_observations set contributor_alias = u where contributor_id = p_user_id;
  update public.level_requirement_observations set contributor_alias = u where contributor_id = p_user_id;
  delete from public.login_attempts where username in (old, u);
end $$;

-- Admin: delete a player's account. Their private data goes with it; reports they shared
-- stay on record under their last username. The admin can't delete their own account here.
create or replace function public.admin_delete_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare old text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_user_id = auth.uid() then raise exception 'You can''t delete your own account here'; end if;
  select username into old from public.player_profiles where user_id = p_user_id;
  delete from public.login_attempts where username = old;
  delete from auth.users where id = p_user_id;
  if not found then raise exception 'Player not found'; end if;
end $$;

-- Admin: settle a conflict by confirming the chosen observations and rejecting the others.
create or replace function public.admin_resolve(p_table text, p_keep uuid[], p_reject uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_table not in ('price_observations','exp_observations','level_requirement_observations') then
    raise exception 'Unknown table';
  end if;
  execute format('update public.%I set status = ''confirmed'' where id = any($1)', p_table) using p_keep;
  execute format('update public.%I set status = ''rejected'' where id = any($1)', p_table) using p_reject;
end $$;

revoke all on function public.login_wait(text), public.login_failed(text), public.login_ok(),
  public.admin_reset_pin(uuid, text), public.admin_resolve(text, uuid[], uuid[]),
  public.admin_set_approved(uuid, boolean), public.admin_rename(uuid, text), public.admin_delete_user(uuid) from public;
grant execute on function public.login_wait(text), public.login_failed(text) to anon, authenticated;
grant execute on function public.login_ok(), public.admin_reset_pin(uuid, text),
  public.admin_resolve(text, uuid[], uuid[]), public.admin_set_approved(uuid, boolean),
  public.admin_rename(uuid, text), public.admin_delete_user(uuid), public.is_approved() to authenticated;

-- Table privileges (RLS above still decides which rows). Start from nothing, then grant.
revoke all on public.upgrade_catalog, public.app_admins, public.price_observations, public.exp_observations,
  public.level_requirement_observations, public.observation_flags, public.player_profiles,
  public.player_progress, public.player_upgrade_state, public.purchase_history, public.login_attempts from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.upgrade_catalog to anon, authenticated;
grant select on public.price_observations, public.exp_observations,
  public.level_requirement_observations to authenticated;
grant insert on public.price_observations, public.exp_observations,
  public.level_requirement_observations, public.observation_flags to authenticated;
grant update (status, notes) on public.price_observations, public.exp_observations,
  public.level_requirement_observations to authenticated;
grant select on public.observation_flags, public.app_admins to authenticated;
grant update (resolved) on public.observation_flags to authenticated;
grant select on public.player_profiles to authenticated;
grant select, insert, update, delete on public.player_progress,
  public.player_upgrade_state, public.purchase_history to authenticated;

-- ---------------------------------------------------------------------
-- Fixing wrong reports (also shipped alone as 0004_fix_reports.sql).
-- ---------------------------------------------------------------------

create or replace function public.admin_edit_observation(
  p_type text, p_id uuid, p_to_level int, p_value bigint, p_move_purchase boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record; delta int; was text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_value is null or p_value < 0 then raise exception 'Enter a value of 0 or more'; end if;
  if p_to_level is null or p_to_level < 1 then raise exception 'Level must be 1 or more'; end if;

  if p_type = 'level_req' then
    select * into r from public.level_requirement_observations where id = p_id;
    if not found then raise exception 'Report not found'; end if;
    if p_value = 0 then raise exception 'XP needed must be more than 0'; end if;
    was := format('LVL %s, %s XP', r.level, r.exp_required);
    update public.level_requirement_observations
      set level = p_to_level, exp_required = p_value,
          notes = left(trim(both ' ' from notes || format(' [Admin fixed %s: was %s]', to_char(now(), 'YYYY-MM-DD'), was)), 500)
      where id = p_id;
    return;
  end if;

  if p_type = 'price' then
    select * into r from public.price_observations where id = p_id;
  elsif p_type = 'exp' then
    select * into r from public.exp_observations where id = p_id;
  else
    raise exception 'Unknown report type';
  end if;
  if not found then raise exception 'Report not found'; end if;

  delta := p_to_level - r.to_level;
  if r.from_level + delta < 0 then raise exception 'That level is too low for this report'; end if;

  if p_type = 'price' then
    was := format('Lv %s→%s, cost %s', r.from_level, r.to_level, r.cost);
    update public.price_observations
      set from_level = from_level + delta, to_level = to_level + delta, cost = p_value,
          notes = left(trim(both ' ' from notes || format(' [Admin fixed %s: was %s]', to_char(now(), 'YYYY-MM-DD'), was)), 500)
      where id = p_id;
  else
    was := format('Lv %s→%s, %s XP', r.from_level, r.to_level, r.exp);
    update public.exp_observations
      set from_level = from_level + delta, to_level = to_level + delta, exp = p_value,
          notes = left(trim(both ' ' from notes || format(' [Admin fixed %s: was %s]', to_char(now(), 'YYYY-MM-DD'), was)), 500)
      where id = p_id;
  end if;

  -- Move the purchase's other reports (same purchase, same software) by the same number of levels.
  if p_move_purchase and r.purchase_id is not null and delta <> 0 then
    update public.price_observations
      set from_level = from_level + delta, to_level = to_level + delta,
          notes = left(trim(both ' ' from notes || format(' [Admin moved %s: was Lv %s→%s]', to_char(now(), 'YYYY-MM-DD'), from_level, to_level)), 500)
      where purchase_id = r.purchase_id and upgrade_id = r.upgrade_id and id <> p_id and from_level + delta >= 0;
    update public.exp_observations
      set from_level = from_level + delta, to_level = to_level + delta,
          notes = left(trim(both ' ' from notes || format(' [Admin moved %s: was Lv %s→%s]', to_char(now(), 'YYYY-MM-DD'), from_level, to_level)), 500)
      where purchase_id = r.purchase_id and upgrade_id = r.upgrade_id and id <> p_id and from_level + delta >= 0;
  end if;
end $$;

-- A player takes back their own report (wrong button). It stays on record as rejected.
create or replace function public.withdraw_observation(p_type text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null or not public.is_approved() then raise exception 'Sign in first'; end if;
  if p_type = 'price' then
    update public.price_observations set status = 'rejected',
      notes = left(trim(both ' ' from notes || ' [Withdrawn by reporter]'), 500)
      where id = p_id and contributor_id = auth.uid() and status = 'observed';
  elsif p_type = 'exp' then
    update public.exp_observations set status = 'rejected',
      notes = left(trim(both ' ' from notes || ' [Withdrawn by reporter]'), 500)
      where id = p_id and contributor_id = auth.uid() and status = 'observed';
  elsif p_type = 'level_req' then
    update public.level_requirement_observations set status = 'rejected',
      notes = left(trim(both ' ' from notes || ' [Withdrawn by reporter]'), 500)
      where id = p_id and contributor_id = auth.uid() and status = 'observed';
  else
    raise exception 'Unknown report type';
  end if;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'You can only remove your own reports that the admin hasn''t confirmed yet'; end if;
end $$;

revoke all on function public.admin_edit_observation(text, uuid, int, bigint, boolean), public.withdraw_observation(text, uuid) from public;
grant execute on function public.admin_edit_observation(text, uuid, int, bigint, boolean), public.withdraw_observation(text, uuid) to authenticated;
