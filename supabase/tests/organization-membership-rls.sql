-- Regression test for Organization-level membership + the org-membership
-- access gate (docs/organization-permission-structure.md). Written BEFORE
-- the schema/RLS migrations that make it pass (TDD RED, then GREEN once
-- 20260815000000_organization_membership_schema.sql and
-- 20260815000100_organization_membership_gate.sql land).
--
-- Run against a local Supabase Postgres:
--
--   supabase start && supabase db reset
--   docker exec supabase_db_beacon psql -U postgres -c "
--     grant usage on schema public to anon, authenticated, service_role;
--     grant all on all tables in schema public to anon, authenticated, service_role;
--     grant all on all sequences in schema public to anon, authenticated, service_role;
--   "
--   docker exec -i supabase_db_beacon psql -U postgres < supabase/tests/organization-membership-rls.sql
--
-- Every step runs as the authenticated user PostgREST would run it (via
-- request.jwt.claims + `set local role authenticated`), not as the postgres
-- superuser, so RLS is genuinely exercised. Expected results are annotated
-- inline; the whole script rolls back, leaving no fixture data.

\set ON_ERROR_STOP off
begin;

-- =============================================================================
-- Setup: two Organizations, two Users. User A creates+owns Org 1 and has a
-- Space + Permission row inside it. User B has no membership in Org 1 at all.
-- =============================================================================

insert into public.organizations (id, name, domain, is_domain_verified)
values ('e0000000-0000-0000-0000-00000000000e', 'Org One', null, false);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('a0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-a@example.com', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('c0000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-000000000000','authenticated','authenticated','stranger-c@example.com', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '');

-- profiles rows are created by handle_new_user automatically on auth.users
-- insert; point them at Org One for a stable organization_id "active org"
-- pointer (no longer authoritative for access after the gate migration).
update public.profiles set organization_id = 'e0000000-0000-0000-0000-00000000000e'
where id in ('a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000c');

-- =============================================================================
-- Case 1: organization_memberships bootstrap — User A, as Org One's creator,
-- claims the sole OWNER row while zero membership rows exist yet for Org One.
-- EXPECT: one row inserted, role = 'owner'.
-- =============================================================================

select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into public.organization_memberships (organization_id, user_id, role)
values ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a', 'owner')
returning organization_id, role as expect_owner_bootstrap_ok;

-- =============================================================================
-- Case 2: exactly one OWNER per org — a second OWNER row for the same org
-- must be rejected even from a privileged actor.
-- EXPECT: ERROR (unique_violation on the partial owner index).
-- =============================================================================

reset role;
insert into public.organization_memberships (organization_id, user_id, role)
values ('e0000000-0000-0000-0000-00000000000e', 'c0000000-0000-0000-0000-00000000000c', 'owner');

-- =============================================================================
-- Case 3: org-membership gate on Space/Page access — User A creates a Space
-- inside Org One and grants themselves admin Permission (the existing
-- useCreateSpace bootstrap sequence). EXPECT: both succeed for a real member.
-- =============================================================================

select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into public.spaces (id, organization_id, name, category, is_publishable, created_by_user_id)
values ('b0000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-00000000000e', 'Test Space', null, false, 'a0000000-0000-0000-0000-00000000000a')
returning id, name as expect_space_created_ok;

insert into public.permissions (space_id, user_id, role)
values ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'admin')
returning id, role as expect_permission_created_ok;

-- =============================================================================
-- Case 4: the actual gate — User C has a would-be-valid Permission row
-- attempted on the same Space, but is NOT an organization_memberships member
-- of Org One. The write-time trigger must reject it even though C is
-- otherwise indistinguishable from a normal insert.
-- EXPECT: ERROR (not an org member).
-- =============================================================================

reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-0000-0000-00000000000c', 'role', 'authenticated')::text, true);
set local role authenticated;

insert into public.permissions (space_id, user_id, role)
values ('b0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000c', 'admin');

-- =============================================================================
-- Case 5: read-time gate — simulate a Permission row existing for a user who
-- is NOT (or no longer) an org member (e.g. removed from the org without
-- their Space permissions being cleaned up first). user_space_role() must
-- return null / no access, not just block new inserts.
-- Done as postgres (bypassing the write-time trigger) to construct the
-- otherwise-impossible state, then re-checked as that user under RLS.
-- =============================================================================

reset role;
insert into public.permissions (space_id, user_id, role)
values ('b0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000c', 'viewer')
on conflict (space_id, user_id) do update set role = excluded.role;

select set_config('request.jwt.claims', json_build_object('sub', 'c0000000-0000-0000-0000-00000000000c', 'role', 'authenticated')::text, true);
set local role authenticated;

-- EXPECT: count = 0 — a stale Permission row for a non-org-member must not
-- grant Space visibility.
select 'non-member with stale permission row sees the space, expect 0:' as check, count(*)
from public.spaces where id = 'b0000000-0000-0000-0000-00000000000b';

rollback;
