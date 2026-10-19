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

-- ---------- accounts (as Supabase Auth would create them) ----------
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@users.hedb.app', '{"username":"alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@users.hedb.app',   '{"username":"bob"}'),
  ('33333333-3333-3333-3333-333333333333', 'carl@users.hedb.app',  '{"username":"carl"}');
insert into auth.identities (user_id, provider, identity_data) values
  ('22222222-2222-2222-2222-222222222222', 'email', '{"email":"bob@users.hedb.app"}');
do $$ begin
  if exists (select 1 from public.player_profiles where approved) then raise exception 'FAILED: new accounts should start unapproved'; end if;
end $$;
-- carl stays pending; alice and bob are approved for the rest of the tests
update public.player_profiles set approved = true where username in ('alice', 'bob');
do $$ begin
  if (select count(*) from public.player_profiles) <> 3 then raise exception 'FAILED: sign-up trigger did not create profiles'; end if;
end $$;
select pg_temp.expect_error($$insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'x@users.hedb.app', '{"username":"Bad Name!"}')$$, 'invalid username');
select pg_temp.expect_error($$insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'alice2@users.hedb.app', '{"username":"alice"}')$$, 'duplicate username');

-- ---------- anon ----------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if (select count(*) from public.upgrade_catalog) <> 16 then raise exception 'FAILED: anon should read 16 catalog rows'; end if;
end $$;
select pg_temp.expect_error($$select * from public.price_observations$$, 'anon read observations');
do $$ begin
  -- lockout: 5 wrong PINs locks the username
  perform public.login_failed('alice'); perform public.login_failed('alice'); perform public.login_failed('alice'); perform public.login_failed('alice');
  if public.login_wait('alice') <> 0 then raise exception 'FAILED: locked too early'; end if;
  if public.login_failed('alice') <> 0 then raise exception 'FAILED: 5th failure should lock'; end if;
  if public.login_wait('alice') < 800 then raise exception 'FAILED: alice should be locked ~15 min'; end if;
end $$;
select pg_temp.expect_error($$select * from public.login_attempts$$, 'anon read login attempts');
select pg_temp.expect_error($$select public.admin_reset_pin('22222222-2222-2222-2222-222222222222', '1234')$$, 'anon reset PIN');
select pg_temp.expect_error($$insert into public.price_observations (upgrade_id, method, from_level, to_level, cost, cost_type) values ('spam','store',5,6,123456,'per_level')$$, 'anon insert observation');
select pg_temp.expect_error($$select * from public.player_progress$$, 'anon read player_progress');
reset role;

-- ---------- pending user (not approved yet) ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$ begin
  if exists (select 1 from public.price_observations) then raise exception 'FAILED: pending user can read research'; end if;
  if (select approved from public.player_profiles where user_id = auth.uid()) then raise exception 'FAILED: pending user sees approved'; end if;
end $$;
select pg_temp.expect_error($$insert into public.price_observations (upgrade_id, method, from_level, to_level, cost, cost_type) values ('spam','store',5,6,1,'per_level')$$, 'pending user adds research');
select pg_temp.expect_error($$insert into public.player_progress (level, exp, required) values (1, 0, 100)$$, 'pending user saves device');
select pg_temp.expect_error($$select public.admin_set_approved('33333333-3333-3333-3333-333333333333', true)$$, 'pending user approves self');
reset role;

-- ---------- user A ----------
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.player_progress (level, exp, required) values (4, 90, 130);
insert into public.player_upgrade_state (upgrade_id, level) values ('spam', 5), ('device', 12);
insert into public.purchase_history (upgrade_id, method, from_level, to_level, cost, cost_source, exp_earned, exp_expected,
  before_level, before_exp, before_required, after_level, after_exp, after_required, confidence)
  values ('spam','store',4,5,500,'observed',5,5,4,90,130,4,95,130,'uses_unverified');
insert into public.price_observations (upgrade_id, method, from_level, to_level, cost, cost_type, contributor_alias) values ('spam','store',5,6,123456,'per_level','someone_else');
do $$ begin
  if (select contributor_alias from public.price_observations where cost = 123456) <> 'alice' then raise exception 'FAILED: contributor name not stamped from profile'; end if;
  if (select count(*) from public.player_profiles) <> 1 then raise exception 'FAILED: non-admin sees other profiles'; end if;
end $$;
select pg_temp.expect_error($$update public.player_profiles set username = 'mallory'$$, 'rename own username');
select pg_temp.expect_error($$select public.admin_reset_pin('22222222-2222-2222-2222-222222222222', '1234')$$, 'non-admin reset PIN');
select pg_temp.expect_error($$select public.admin_resolve('price_observations', array[]::uuid[], array[]::uuid[])$$, 'non-admin resolve conflict');
select pg_temp.expect_error($$select public.admin_rename('22222222-2222-2222-2222-222222222222', 'mallory')$$, 'non-admin rename');
select pg_temp.expect_error($$select public.admin_delete_user('22222222-2222-2222-2222-222222222222')$$, 'non-admin delete');
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
  update public.price_observations set status = 'confirmed' where cost = 123456;
  if exists (select 1 from public.price_observations where cost = 123456 and status = 'confirmed') then
    raise exception 'FAILED: non-admin confirmed an observation';
  end if;
end $$;
select pg_temp.expect_error($$delete from public.price_observations$$, 'delete shared observations');
select pg_temp.expect_error($$update public.price_observations set cost = 1 where cost = 123456$$, 'edit raw cost through API');
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
  if not exists (select 1 from public.price_observations where cost = 123456) or (select count(*) from public.price_observations) < 5 then raise exception 'FAILED: B cannot read shared data'; end if;
end $$;
insert into public.observation_flags (observation_type, observation_id, reason)
  select 'price', id, 'looks wrong' from public.price_observations where cost = 123456;
reset role;

do $$ begin
  if (select level from public.player_progress where user_id = '11111111-1111-1111-1111-111111111111') <> 4 then raise exception 'FAILED: B changed A''s progress'; end if;
  if (select count(*) from public.purchase_history) <> 1 then raise exception 'FAILED: B deleted A''s history'; end if;
end $$;

-- ---------- admin ----------
insert into public.app_admins values ('11111111-1111-1111-1111-111111111111');
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into public.price_observations (upgrade_id, method, from_level, to_level, cost, cost_type) values ('spam','store',5,6,123457,'per_level');
select public.admin_resolve('price_observations',
  array(select id from public.price_observations where cost = 123456), array(select id from public.price_observations where cost = 123457));
update public.observation_flags set resolved = true;
select public.admin_reset_pin('22222222-2222-2222-2222-222222222222', '4321');
do $$ begin
  if (select count(*) from public.player_profiles) <> 3 then raise exception 'FAILED: admin should see all profiles'; end if;
end $$;
-- approve the pending player
select public.admin_set_approved('33333333-3333-3333-3333-333333333333', true);
-- rename bob -> robert: sign-in email and earlier reports follow
reset role;  -- set up an earlier report by bob (as the database owner)
insert into public.price_observations (upgrade_id, method, from_level, to_level, cost, cost_type, contributor_id, contributor_alias)
  values ('spam','store',6,7,777777,'per_level','22222222-2222-2222-2222-222222222222','bob');
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select public.admin_rename('22222222-2222-2222-2222-222222222222', 'Robert');
select pg_temp.expect_error($$select public.admin_rename('33333333-3333-3333-3333-333333333333', 'robert')$$, 'rename to a taken name');
select pg_temp.expect_error($$select public.admin_rename('33333333-3333-3333-3333-333333333333', 'no spaces!')$$, 'rename to an invalid name');
-- admin renames themselves and stays admin
select public.admin_rename('11111111-1111-1111-1111-111111111111', 'hilltop');
do $$ begin
  if not public.is_admin() then raise exception 'FAILED: admin lost admin after renaming self'; end if;
end $$;
select pg_temp.expect_error($$select public.admin_delete_user('11111111-1111-1111-1111-111111111111')$$, 'admin deletes own account');
select public.admin_delete_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect_error($$select public.admin_reset_pin('22222222-2222-2222-2222-222222222222', '12a4')$$, 'bad PIN format');
reset role;
do $$ begin
  if (select status from public.price_observations where cost = 123457) <> 'rejected' then raise exception 'FAILED: losing value not rejected'; end if;
  if (select encrypted_password from auth.users where id = '22222222-2222-2222-2222-222222222222') <> crypt('hedb#4321#pin', (select encrypted_password from auth.users where id = '22222222-2222-2222-2222-222222222222')) then
    raise exception 'FAILED: PIN reset did not set the expected password';
  end if;
end $$;
do $$ begin
  if not exists (select 1 from public.price_observations where cost = 123456 and status = 'confirmed') then raise exception 'FAILED: admin could not confirm'; end if;
  if exists (select 1 from public.observation_flags where not resolved) then raise exception 'FAILED: admin could not resolve flag'; end if;
end $$;

do $$ begin
  if (select username from public.player_profiles where user_id = '22222222-2222-2222-2222-222222222222') <> 'robert' then raise exception 'FAILED: rename profile'; end if;
  if (select email from auth.users where id = '22222222-2222-2222-2222-222222222222') <> 'robert@users.hedb.app' then raise exception 'FAILED: rename sign-in email'; end if;
  if (select identity_data->>'email' from auth.identities where user_id = '22222222-2222-2222-2222-222222222222') <> 'robert@users.hedb.app' then raise exception 'FAILED: rename identity'; end if;
  if (select contributor_alias from public.price_observations where cost = 777777) <> 'robert' then raise exception 'FAILED: earlier reports not relabelled'; end if;
  if (select username from public.player_profiles where user_id = '11111111-1111-1111-1111-111111111111') <> 'hilltop' then raise exception 'FAILED: self rename'; end if;
  if exists (select 1 from auth.users where id = '33333333-3333-3333-3333-333333333333') then raise exception 'FAILED: delete user'; end if;
  if exists (select 1 from public.player_profiles where user_id = '33333333-3333-3333-3333-333333333333') then raise exception 'FAILED: deleted profile remains'; end if;
end $$;

select 'ALL RLS TESTS PASSED' as result;
