-- pgTAP suite for PRD.md Epic 9 (US9.1-US9.3) RLS acceptance criteria.
--
-- STATUS: authored against the schema in ../../migrations/, not yet
-- executed — this session has no reachable Postgres/Supabase instance
-- (no Docker, no local Postgres; see the Stage 2 evidence report). Run via:
--   supabase test db
-- against a real local Supabase stack (which provides the actual `auth`
-- schema / auth.uid() this suite relies on) before trusting these as GREEN.
--
-- Each test impersonates a Postgres role the way Supabase's PostgREST layer
-- does: `set local role` to `anon`/`authenticated`, and
-- `set local request.jwt.claim.sub` so `auth.uid()` resolves to the test
-- subject, exactly as it would for a real API request carrying that JWT.

begin;
select plan(7);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

insert into public.organizations (id, name, domain, is_domain_verified)
values ('00000000-0000-0000-0000-00000000000a', 'Dibimbing', 'docs.dibimbing.id', true);

-- Two real auth.users rows so the profiles FK and auth.uid() both resolve.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@dibimbing.test'),
  ('00000000-0000-0000-0000-000000000002', 'viewer@dibimbing.test');

insert into public.profiles (id, email, name, organization_id) values
  ('00000000-0000-0000-0000-000000000001', 'owner@dibimbing.test', 'Org Owner', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-000000000002', 'viewer@dibimbing.test', 'Space Viewer', '00000000-0000-0000-0000-00000000000a');

insert into public.organization_memberships (organization_id, user_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000002', 'member');

insert into public.spaces (id, organization_id, name, is_publishable, created_by_user_id) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000a', 'Mobile App', false, '00000000-0000-0000-0000-000000000001');

insert into public.permissions (space_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000002', 'viewer');

insert into public.pages (id, space_id, title, content, visibility, is_published, created_by_user_id) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'Internal SOP', '{}'::jsonb, 'internal', false, '00000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- US9.2 AC 1 — anon reading an internal-only Page returns zero rows.
-- ---------------------------------------------------------------------------

set local role anon;
select is(
  (select count(*)::int from public.pages where id = '00000000-0000-0000-0000-0000000000c1'),
  0,
  'anon cannot read an internal-only Page'
);
reset role;

-- ---------------------------------------------------------------------------
-- US9.2 AC 2 — a viewer-role User's write attempt is rejected.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';

-- RLS UPDATE with a WHERE clause the policy filters out doesn't raise — it
-- just matches/affects 0 rows, so assert the row is unchanged rather than
-- expecting an exception.
update public.pages set title = 'Hacked' where id = '00000000-0000-0000-0000-0000000000c1';

select is(
  (select title from public.pages where id = '00000000-0000-0000-0000-0000000000c1'),
  'Internal SOP',
  'viewer-role User UPDATE affects zero rows (title unchanged)'
);
reset role;

-- ---------------------------------------------------------------------------
-- US9.2 AC 3 — an editor/admin CAN update their own Space's Page.
-- ---------------------------------------------------------------------------

insert into public.permissions (space_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000001', 'admin');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

update public.pages set title = 'Updated SOP' where id = '00000000-0000-0000-0000-0000000000c1';

select is(
  (select title from public.pages where id = '00000000-0000-0000-0000-0000000000c1'),
  'Updated SOP',
  'admin-role User can update a Page in their own Space'
);
reset role;

-- ---------------------------------------------------------------------------
-- US9.3 — a member (non-owner) cannot update their Organization's domain.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';

update public.organizations set domain = 'evil.example.com'
where id = '00000000-0000-0000-0000-00000000000a';

select is(
  (select domain from public.organizations where id = '00000000-0000-0000-0000-00000000000a'),
  'docs.dibimbing.id',
  'member-role (non-owner) User UPDATE on Organization.domain affects zero rows'
);
reset role;

-- ---------------------------------------------------------------------------
-- Owner CAN update their own Organization's domain.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

update public.organizations set domain = 'docs.dibimbing.id'
where id = '00000000-0000-0000-0000-00000000000a';

select is(
  (select domain from public.organizations where id = '00000000-0000-0000-0000-00000000000a'),
  'docs.dibimbing.id',
  'owner-role User can update their own Organization domain'
);
reset role;

-- ---------------------------------------------------------------------------
-- permissions bootstrap: a Space's own creator can insert their first (and
-- only their own) admin permission row; a different, unrelated User cannot
-- use the same bootstrap clause to self-grant admin on someone else's Space.
-- ---------------------------------------------------------------------------

insert into public.spaces (id, organization_id, name, is_publishable, created_by_user_id) values
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000000a', 'Admin Dashboard', false, '00000000-0000-0000-0000-000000000001');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

insert into public.permissions (space_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000001', 'admin');

select is(
  (select role from public.permissions where space_id = '00000000-0000-0000-0000-0000000000b2' and user_id = '00000000-0000-0000-0000-000000000001'),
  'admin',
  'a Space''s own creator can bootstrap their own admin permission row'
);
reset role;

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';

select throws_ok(
  $$ insert into public.permissions (space_id, user_id, role) values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000002', 'admin') $$,
  '42501',
  null,
  'a non-creator cannot use the bootstrap clause to self-grant admin on someone else''s Space'
);
reset role;

select * from finish();
rollback;
