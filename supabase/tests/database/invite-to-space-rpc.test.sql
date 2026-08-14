-- pgTAP suite for invite_to_space() (20260814000000_invite_to_space_rpc.sql),
-- completing PRD.md Flow 7 step 4 for existing-Account teammates.
--
-- STATUS: authored against the schema in ../../migrations/, same caveat as
-- rls_policies.test.sql — this session has no reachable local Postgres/
-- Supabase stack to run `supabase test db` against. Real RED/GREEN evidence
-- for this behavior was instead captured by hand-rolled SQL assertions run
-- directly against the linked remote database (see
-- docs/testing/invite-existing-member-to-space.tdd.md); run this suite via
-- `supabase test db` against a real local stack before trusting it as GREEN
-- in CI.

begin;
select plan(6);

-- ---------------------------------------------------------------------------
-- Fixtures — two Organizations so the cross-Organization rejection has
-- something real to reject against.
-- ---------------------------------------------------------------------------

insert into public.organizations (id, name, slug, domain, is_domain_verified) values
  ('00000000-0000-0000-0000-00000000000a', 'Dibimbing', 'dibimbing', 'docs.dibimbing.id', true),
  ('00000000-0000-0000-0000-00000000000b', 'Cakrawala University', 'cakrawala-university', null, false);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'admin@dibimbing.test'),
  ('00000000-0000-0000-0000-000000000002', 'teammate@dibimbing.test'),
  ('00000000-0000-0000-0000-000000000003', 'outsider@cakrawala.test'),
  ('00000000-0000-0000-0000-000000000004', 'viewer@dibimbing.test');

insert into public.profiles (id, email, name, organization_id, organization_role) values
  ('00000000-0000-0000-0000-000000000001', 'admin@dibimbing.test', 'Space Admin', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('00000000-0000-0000-0000-000000000002', 'teammate@dibimbing.test', 'Existing Teammate', '00000000-0000-0000-0000-00000000000a', 'member'),
  ('00000000-0000-0000-0000-000000000003', 'outsider@cakrawala.test', 'Cross-Org User', '00000000-0000-0000-0000-00000000000b', 'member'),
  ('00000000-0000-0000-0000-000000000004', 'viewer@dibimbing.test', 'Space Viewer', '00000000-0000-0000-0000-00000000000a', 'member');

insert into public.spaces (id, organization_id, name, is_publishable, created_by_user_id) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000a', 'Mobile App', false, '00000000-0000-0000-0000-000000000001');

insert into public.permissions (space_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000001', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000004', 'viewer');

-- ---------------------------------------------------------------------------
-- 1. A Space admin inviting an existing same-Organization Account is
--    granted the Permission immediately — no pending_invites row at all.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

select is(
  (public.invite_to_space('00000000-0000-0000-0000-0000000000b1', 'teammate@dibimbing.test', 'editor') ->> 'status'),
  'added',
  'inviting an existing same-Org Account returns status=added'
);

select is(
  (select role from public.permissions where space_id = '00000000-0000-0000-0000-0000000000b1' and user_id = '00000000-0000-0000-0000-000000000002'),
  'editor',
  'the existing Account is granted the invited role immediately'
);

select is(
  (select count(*)::int from public.pending_invites where space_id = '00000000-0000-0000-0000-0000000000b1' and email = 'teammate@dibimbing.test'),
  0,
  'no pending_invites row is created for an immediately-granted existing Account'
);

-- ---------------------------------------------------------------------------
-- 2. An email with no Account yet still falls back to pending_invites.
-- ---------------------------------------------------------------------------

select is(
  (public.invite_to_space('00000000-0000-0000-0000-0000000000b1', 'brand-new@dibimbing.test', 'viewer') ->> 'status'),
  'invited',
  'inviting an email with no Account returns status=invited'
);

-- ---------------------------------------------------------------------------
-- 3. An email belonging to a *different* Organization is rejected outright
--    (it could never resolve via handle_new_user, since that email already
--    has a profile permanently tied to a different organization_id).
-- ---------------------------------------------------------------------------

select throws_like(
  $$ select public.invite_to_space('00000000-0000-0000-0000-0000000000b1', 'outsider@cakrawala.test', 'viewer') $$,
  'EMAIL_BELONGS_TO_ANOTHER_ORGANIZATION%',
  'inviting a different-Organization Account is rejected, not silently queued'
);
reset role;

-- ---------------------------------------------------------------------------
-- 4. A non-admin (viewer-role) Space member cannot call the RPC to grant
--    themselves or others access.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';

select throws_like(
  $$ select public.invite_to_space('00000000-0000-0000-0000-0000000000b1', 'someone-else@dibimbing.test', 'admin') $$,
  'NOT_AUTHORIZED%',
  'a viewer-role Space member cannot call invite_to_space'
);
reset role;

select * from finish();
rollback;
