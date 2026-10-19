-- Test-only stand-in for Supabase's auth schema and roles (NOT for Supabase itself).
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create extension if not exists pgcrypto;
create schema auth;
create table auth.users (id uuid primary key, email text unique, encrypted_password text, raw_user_meta_data jsonb, updated_at timestamptz);
create table auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, provider text, identity_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant select on auth.users to anon, authenticated;
-- Supabase-like default: broad grants that the migration must narrow.
alter default privileges in schema public grant all on tables to anon, authenticated;
