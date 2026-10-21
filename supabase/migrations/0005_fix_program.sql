-- HEDB: the admin fix tool can also move a report to the right PROGRAM (wrong program picked).
-- Replaces admin_edit_observation with a version that takes an optional program. Safe to run more than once.

drop function if exists public.admin_edit_observation(text, uuid, int, bigint, boolean);

create or replace function public.admin_edit_observation(
  p_type text, p_id uuid, p_to_level int, p_value bigint, p_move_purchase boolean default false, p_upgrade_id text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record; delta int; was text; prog text; moved_prog boolean;
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

  prog := coalesce(nullif(p_upgrade_id, ''), r.upgrade_id);
  moved_prog := prog <> r.upgrade_id;
  delta := p_to_level - r.to_level;
  if r.from_level + delta < 0 then raise exception 'That level is too low for this report'; end if;

  if p_type = 'price' then
    was := format('%sLv %s→%s, cost %s', case when moved_prog then r.upgrade_id || ' ' else '' end, r.from_level, r.to_level, r.cost);
    update public.price_observations
      set upgrade_id = prog, from_level = from_level + delta, to_level = to_level + delta, cost = p_value,
          notes = left(trim(both ' ' from notes || format(' [Admin fixed %s: was %s]', to_char(now(), 'YYYY-MM-DD'), was)), 500)
      where id = p_id;
  else
    was := format('%sLv %s→%s, %s XP', case when moved_prog then r.upgrade_id || ' ' else '' end, r.from_level, r.to_level, r.exp);
    update public.exp_observations
      set upgrade_id = prog, from_level = from_level + delta, to_level = to_level + delta, exp = p_value,
          notes = left(trim(both ' ' from notes || format(' [Admin fixed %s: was %s]', to_char(now(), 'YYYY-MM-DD'), was)), 500)
      where id = p_id;
  end if;

  -- The purchase's other reports (same purchase, same original program) follow the move.
  if p_move_purchase and r.purchase_id is not null and (delta <> 0 or moved_prog) then
    update public.price_observations
      set upgrade_id = prog, from_level = from_level + delta, to_level = to_level + delta,
          notes = left(trim(both ' ' from notes || format(' [Admin moved %s: was %sLv %s→%s]', to_char(now(), 'YYYY-MM-DD'), case when moved_prog then upgrade_id || ' ' else '' end, from_level, to_level)), 500)
      where purchase_id = r.purchase_id and upgrade_id = r.upgrade_id and id <> p_id and from_level + delta >= 0;
    update public.exp_observations
      set upgrade_id = prog, from_level = from_level + delta, to_level = to_level + delta,
          notes = left(trim(both ' ' from notes || format(' [Admin moved %s: was %sLv %s→%s]', to_char(now(), 'YYYY-MM-DD'), case when moved_prog then upgrade_id || ' ' else '' end, from_level, to_level)), 500)
      where purchase_id = r.purchase_id and upgrade_id = r.upgrade_id and id <> p_id and from_level + delta >= 0;
  end if;
end $$;

revoke all on function public.admin_edit_observation(text, uuid, int, bigint, boolean, text) from public;
grant execute on function public.admin_edit_observation(text, uuid, int, bigint, boolean, text) to authenticated;
