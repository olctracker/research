-- RLS and validation tests. Run after 00_supabase_stub.sql + both migrations
-- on a throwaway local Postgres. Any failed check raises an exception.
\set ON_ERROR_STOP on

create or replace function pg_temp.expect_error(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok (blocked): %', label;
    return;
  end;
  raise exception 'FAILED: % should have been blocked', label;
end $$;
grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;

-- ---------- anon ----------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if (select count(*) from public.upgrade_catalog) <> 16 then raise exception 'FAILED: anon should read 16 catalog rows'; end if;
  if (select count(*) from public.price_observations) <> 4 then raise exception 'FAILED: anon should read seed prices'; end if;
end $$;
select pg_temp.expect_error($$insert into public.price_observations (upgrade_id, method, from_level, to_level, cost, cost_type) values ('spam','store',5,6,600,'per_level')$$, 'anon insert observation');
select pg_temp.expect_error($$select * from public.player_progress$$, 'anon read player_progress');
reset role;

-- ---------- user A ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.player_progress (level, exp, required) values (4, 90, 130);
insert into public.player_upgrade_state (upgrade_id, level) values ('spam', 5), ('device', 12);
insert into public.purchase_history (upgrade_id, method, from_level, to_level, cost, cost_source, exp_earned, exp_expected,
  before_level, before_exp, before_required, after_level, after_exp, after_required, confidence)
  values ('spam','store',4,5,500,'observed',5,5,4,90,130,4,95,130,'uses_unverified');
insert into public.price_observations (upgrade_id, method, from_level, to_level, cost, cost_type) values ('spam','store',5,6,600,'per_level');
insert into public.level_requirement_observations (level, exp_required) values (4, 130);

select pg_temp.expect_error($$insert into public.price_observations (upgrade_id, method, from_level, to_level, cost, cost_type, status) values ('spam','store',6,7,700,'per_level','confirmed')$$, 'self-confirm an observation');
select pg_temp.expect_error($$insert into public.price_observations (upgrade_id, method, from_level, to_level, cost, cost_type, contributor_id) values ('spam','store',6,7,700,'per_level','22222222-2222-2222-2222-222222222222')$$, 'contribute as someone else');
select pg_temp.expect_error($$insert into public.price_observations (upgrade_id, method, from_level, to_level, cost, cost_type, keygen_level) values ('device','download',1,3,100,'combined',5)$$, 'download a store-only upgrade');
select pg_temp.expect_error($$insert into public.price_observations (upgrade_id, method, from_level, to_level, cost, cost_type) values ('botnet','store',7,8,100,'per_level')$$, 'price above Botnet cap');
select pg_temp.expect_error($$insert into public.price_observations (upgrade_id, method, from_level, to_level, cost, cost_type) values ('spam','store',1,4,100,'per_level')$$, 'store per-level spanning 3 levels');
select pg_temp.expect_error($$insert into public.exp_observations (upgrade_id, method, from_level, to_level, exp, exp_basis, source) values ('notepad','store',1,2,10,'per_level','entered')$$, 'second level of a one-time item');
select pg_temp.expect_error($$insert into public.player_upgrade_state (upgrade_id, level) values ('network', 12)$$, 'player Network above cap');
select pg_temp.expect_error($$insert into public.player_progress (user_id, level, exp) values ('22222222-2222-2222-2222-222222222222', 1, 0)$$, 'write another user''s progress');
do $$ begin
  update public.price_observations set status = 'confirmed' where cost = 600;
  if exists (select 1 from public.price_observations where cost = 600 and status = 'confirmed') then
    raise exception 'FAILED: non-admin confirmed an observation';
  end if;
end $$;
select pg_temp.expect_error($$delete from public.price_observations$$, 'delete shared observations');
select pg_temp.expect_error($$update public.price_observations set cost = 1 where cost = 600$$, 'edit raw cost through API');
reset role;

-- ---------- user B ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  if exists (select 1 from public.player_progress) then raise exception 'FAILED: B sees A''s progress'; end if;
  if exists (select 1 from public.player_upgrade_state) then raise exception 'FAILED: B sees A''s levels'; end if;
  if exists (select 1 from public.purchase_history) then raise exception 'FAILED: B sees A''s history'; end if;
  update public.player_progress set level = 99;
  delete from public.purchase_history;   -- allowed for own rows; A's rows are invisible so nothing happens
  if (select count(*) from public.price_observations) <> 5 then raise exception 'FAILED: B cannot read shared data'; end if;
end $$;
insert into public.observation_flags (observation_type, observation_id, reason)
  select 'price', id, 'looks wrong' from public.price_observations where cost = 600;
reset role;

do $$ begin
  if (select level from public.player_progress where user_id = '11111111-1111-1111-1111-111111111111') <> 4 then raise exception 'FAILED: B changed A''s progress'; end if;
  if (select count(*) from public.purchase_history) <> 1 then raise exception 'FAILED: B deleted A''s history'; end if;
end $$;

-- ---------- admin ----------
insert into public.app_admins values ('11111111-1111-1111-1111-111111111111');
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update public.price_observations set status = 'confirmed' where cost = 600;
update public.observation_flags set resolved = true;
reset role;
do $$ begin
  if not exists (select 1 from public.price_observations where cost = 600 and status = 'confirmed') then raise exception 'FAILED: admin could not confirm'; end if;
  if exists (select 1 from public.observation_flags where not resolved) then raise exception 'FAILED: admin could not resolve flag'; end if;
end $$;

select 'ALL RLS TESTS PASSED' as result;
