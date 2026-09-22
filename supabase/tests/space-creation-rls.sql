-- Regression test for the "create Space" RLS bootstrap bug (root-cause
-- writeups: 20260808000000_fix_permissions_bootstrap_rls_recursion.sql,
-- 20260812010000_fix_permissions_bootstrap_column_shadowing.sql).
--
-- Run against a local Supabase Postgres:
--
--   supabase start && supabase db reset
--   docker exec supabase_db_beacon psql -U postgres -c "
--     grant usage on schema public to anon, authenticated, service_role;
--     grant all on all tables in schema public to anon, authenticated, service_role;
--     grant all on all sequences in schema public to anon, authenticated, service_role;
--   "   -- local-only: a hosted Supabase project already has these grants
--       -- from project provisioning; a fresh local `supabase start` does not.
--   docker exec -i supabase_db_beacon psql -U postgres < supabase/tests/space-creation-rls.sql
--
-- Every step below runs as the authenticated user PostgREST would run it
-- (via request.jwt.claims + `set local role authenticated`), not as the
-- postgres superuser, so RLS is genuinely exercised. Expected results are
-- annotated inline; the whole script rolls back, leaving no fixture data.

\set ON_ERROR_STOP off
begin;

-- =============================================================================
-- Positive case: the exact useCreateSpace sequence (src/hooks/use-spaces.ts)
-- for a brand-new, non-publishable Space — its own creator, immediately,
-- with zero Permission rows on it yet.
-- =============================================================================

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('a0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','creator-a@example.com', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '');

-- Signup no longer auto-assigns an Organization (org membership is
-- deliberate, via accept_organization_invite or self-serve creation — see
-- 20260815000100_organization_membership_gate.sql's handle_new_user
-- rewrite) — set up creator A's own Organization + membership explicitly,
-- the same as the real useCreateOrganization flow would.
insert into beacon.organizations (id, name) values ('90000000-0000-0000-0000-000000000009', 'Creator A Org') returning id as org_id \gset
insert into beacon.organization_memberships (organization_id, user_id, role)
values (:'org_id', 'a0000000-0000-0000-0000-00000000000a', 'owner');

select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;

-- Step 1 (useCreateSpace's first write): insert + RETURNING, as
-- `.insert().select().single()` does. EXPECT: one row returned (name
-- visible). Before the fix this raised "new row violates row-level
-- security policy for table spaces".
insert into beacon.spaces (id, organization_id, name, category, is_publishable, created_by_user_id)
values ('b0000000-0000-0000-0000-00000000000b', :'org_id', 'Test Space A', null, false, 'a0000000-0000-0000-0000-00000000000a')
returning id, name as expect_one_row_named_test_space_a;

-- Step 2 (useCreateSpace's second write): the creator's own bootstrap admin
-- Permission row. EXPECT: one row inserted. Before the fix this raised
-- "new row violates row-level security policy for table permissions".
insert into beacon.permissions (space_id, user_id, role)
values ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'admin')
returning id, role as expect_one_row_role_admin;

-- =============================================================================
-- Negative cases: an unrelated authenticated user must gain NO extra access
-- from the bootstrap clauses added by the fix.
-- =============================================================================

reset role;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('c0000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','stranger@example.com', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '');
select set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-0000-0000-00000000000c', 'role', 'authenticated')::text, true);
set local role authenticated;

-- EXPECT: count = 0 — a stranger must not see another creator's
-- non-publishable, no-longer-bootstrapping Space.
select 'stranger sees creator A''s space, expect 0:' as check, count(*)
from beacon.spaces where id = 'b0000000-0000-0000-0000-00000000000b';

-- EXPECT: ERROR (row-level security policy violation) — a stranger must not
-- be able to self-insert an admin Permission row on a Space they did not
-- create, even though that Space already has zero-then-one Permission rows
-- (the bootstrap window logic must key off `is_space_creator`, not merely
-- "no permissions exist yet").
insert into beacon.permissions (space_id, user_id, role)
values ('b0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000c', 'admin');

rollback;

-- =============================================================================
-- Second-Space regression: the exact bug 20260812010000 fixed. Creator A's
-- bootstrap clause used a bare `space_id` inside a correlated subquery
-- against `permissions` (which itself has a `space_id` column) — it bound to
-- the subquery's own row instead of the NEW row, making
-- `not exists(select 1 from permissions p where p.space_id = space_id)` a
-- tautology that was false as soon as the table had ANY row anywhere. That
-- broke bootstrap for every Space after a User's very first one.
-- =============================================================================

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('a0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','creator-a2@example.com', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '');

insert into beacon.organizations (id, name) values ('90000000-0000-0000-0000-000000000009', 'Creator A2 Org') returning id as org_id \gset
insert into beacon.organization_memberships (organization_id, user_id, role)
values (:'org_id', 'a0000000-0000-0000-0000-00000000000a', 'owner');

select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;

-- First Space: zero Permission rows exist anywhere for this user yet.
insert into beacon.spaces (id, organization_id, name, category, is_publishable, created_by_user_id)
values ('b1000000-0000-0000-0000-00000000000b', :'org_id', 'First Space', null, false, 'a0000000-0000-0000-0000-00000000000a');
insert into beacon.permissions (space_id, user_id, role)
values ('b1000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'admin')
returning id, space_id, role as expect_first_space_bootstrap_ok;

-- Second Space, same creator, immediately after. EXPECT: bootstrap succeeds
-- again — this Space has zero Permission rows of its own, and the User
-- already having a Permission row on a *different* Space must not matter.
-- Before the column-shadowing fix, this raised "new row violates row-level
-- security policy for table permissions".
insert into beacon.spaces (id, organization_id, name, category, is_publishable, created_by_user_id)
values ('d1000000-0000-0000-0000-00000000000d', :'org_id', 'Second Space', null, false, 'a0000000-0000-0000-0000-00000000000a');
insert into beacon.permissions (space_id, user_id, role)
values ('d1000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-00000000000a', 'admin')
returning id, space_id, role as expect_second_space_bootstrap_ok;

rollback;
