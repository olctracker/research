-- HEDB upgrade: account approval + admin rename/delete. Safe to run more than once.
alter table public.player_profiles add column if not exists approved boolean not null default false;

create or replace function public.is_approved() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.player_profiles where user_id = auth.uid() and approved) or public.is_admin();
$$;

do $$
declare t text;
begin
  foreach t in array array['price_observations','exp_observations','level_requirement_observations'] loop
    execute format('drop policy if exists obs_read on public.%I', t);
    execute format('create policy obs_read on public.%I for select to authenticated using (public.is_approved())', t);
    execute format('drop policy if exists obs_insert on public.%I', t);
    execute format($p$create policy obs_insert on public.%I for insert to authenticated
                     with check (contributor_id = auth.uid() and status = 'observed' and public.is_approved())$p$, t);
  end loop;
  foreach t in array array['player_progress','player_upgrade_state','purchase_history'] loop
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using (user_id = auth.uid() and public.is_approved()) with check (user_id = auth.uid() and public.is_approved())', t);
  end loop;
end $$;
drop policy if exists flags_read on public.observation_flags;
create policy flags_read on public.observation_flags for select to authenticated using (public.is_approved());
drop policy if exists flags_insert on public.observation_flags;
create policy flags_insert on public.observation_flags for insert to authenticated
  with check (flagged_by = auth.uid() and resolved = false and public.is_approved());

create or replace function public.admin_set_approved(p_user_id uuid, p_approved boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.player_profiles set approved = p_approved where user_id = p_user_id;
  if not found then raise exception 'Player not found'; end if;
end $$;

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

revoke all on function public.admin_set_approved(uuid, boolean), public.admin_rename(uuid, text), public.admin_delete_user(uuid) from public;
grant execute on function public.admin_set_approved(uuid, boolean), public.admin_rename(uuid, text),
  public.admin_delete_user(uuid), public.is_approved() to authenticated;

-- Approve every current admin.
update public.player_profiles set approved = true where user_id in (select user_id from public.app_admins);
