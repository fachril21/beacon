-- ---------------------------------------------------------------------------
-- Namespace bootstrap — every Beacon table, function and RPC lives in a
-- dedicated `beacon` schema (never `public`) so this app can share ONE
-- Supabase project with another app that owns `public`. Both apps still share
-- the project's `auth` schema, so a single sign-in works across both.
--
-- This migration must run before any other. After the full migration set is
-- applied, the schema also has to be exposed to the Data API:
--   Dashboard -> Project Settings -> API
--     * "Exposed schemas"    -> add `beacon`
--     * "Extra search path"  -> add `beacon`
-- Locally the same two settings live in supabase/config.toml ([api].schemas
-- and [api].extra_search_path).
--
-- Run the migrations with `beacon` on the search_path so column DEFAULT
-- expressions (e.g. encode(gen_random_bytes(32), 'hex')) resolve, e.g.:
--   psql "$SUPABASE_DB_URL" -c 'set search_path = beacon, public, extensions' \
--        -f supabase/migrations/<file>.sql
-- ---------------------------------------------------------------------------

create schema if not exists beacon;

-- PostgREST authenticates as `authenticator` and SET ROLEs to one of these;
-- without USAGE on the schema every request 404s before RLS is even reached.
grant usage on schema beacon to anon, authenticated, service_role;

-- gen_random_bytes (invite tokens) comes from pgcrypto, which on Supabase is
-- installed into the shared `extensions` schema.
create extension if not exists "pgcrypto" with schema extensions;
