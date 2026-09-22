-- ---------------------------------------------------------------------------
-- Data API grants for the `beacon` schema.
--
-- In the `public` schema, Supabase provisions ALTER DEFAULT PRIVILEGES for the
-- API roles at project-creation time, so every table is reachable and RLS is
-- the only gate. A custom schema gets none of that: without the grants below,
-- every PostgREST query returns `permission denied for table ...`.
--
-- These are table-level grants only — Row Level Security (enabled on every
-- real table in 20260806100100_rls_policies.sql and friends) is still what
-- decides which rows a caller sees. This mirrors, for `beacon`, the posture
-- `public` already has.
-- ---------------------------------------------------------------------------

grant usage on schema beacon to anon, authenticated, service_role;

-- Existing objects.
grant select, insert, update, delete on all tables in schema beacon to authenticated;
grant select                         on all tables in schema beacon to anon;   -- anonymous published-page reads
grant all                            on all tables in schema beacon to service_role;
grant usage, select on all sequences in schema beacon to authenticated, service_role;
grant execute on all functions in schema beacon to authenticated, service_role;

-- Objects created by later migrations (run as this same role).
alter default privileges in schema beacon
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema beacon
  grant select on tables to anon;
alter default privileges in schema beacon
  grant all on tables to service_role;
alter default privileges in schema beacon
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema beacon
  grant execute on functions to authenticated, service_role;
