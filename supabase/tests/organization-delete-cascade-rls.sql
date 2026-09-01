-- Regression test for Organization update (rename) + delete (cascade),
-- docs/organization-permission-structure.md follow-up (switch-org +
-- manage-org plan). Written BEFORE
-- 20260816000000_organization_update_delete.sql (TDD RED, then GREEN).
--
-- Run:
--   supabase db reset
--   docker exec -i supabase_db_beacon psql -U postgres < supabase/tests/organization-delete-cascade-rls.sql

\set ON_ERROR_STOP off
begin;

-- =============================================================================
-- Setup: Org One (OWNER = A, MEMBER = B), a Space with a Page in it, owned
-- inside Org One.
-- =============================================================================

insert into beacon.organizations (id, name, domain, is_domain_verified)
values ('e0000000-0000-0000-0000-00000000000e', 'Org One', null, false);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('a0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-a@example.com', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('b0000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member-b@example.com', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '');

insert into beacon.organization_memberships (organization_id, user_id, role) values
  ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a', 'owner'),
  ('e0000000-0000-0000-0000-00000000000e', 'b0000000-0000-0000-0000-00000000000b', 'member');

insert into beacon.spaces (id, organization_id, name, is_publishable, created_by_user_id)
values ('b0000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-00000000000e', 'Test Space', false, 'a0000000-0000-0000-0000-00000000000a');

insert into beacon.permissions (space_id, user_id, role)
values ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'admin');

insert into beacon.pages (id, space_id, title, content, visibility, is_published, created_by_user_id)
values ('c0000000-0000-0000-0000-00000000000c', 'b0000000-0000-0000-0000-00000000000b', 'Test Page', '{}'::jsonb, 'internal', false, 'a0000000-0000-0000-0000-00000000000a');

-- =============================================================================
-- Case 1: OWNER can rename the Organization.
-- =============================================================================

select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;

update beacon.organizations set name = 'Org One Renamed' where id = 'e0000000-0000-0000-0000-00000000000e';

select name as expect_renamed from beacon.organizations where id = 'e0000000-0000-0000-0000-00000000000e';

-- =============================================================================
-- Case 2: MEMBER (non-owner) cannot rename the Organization.
-- EXPECT: zero rows affected, name unchanged.
-- =============================================================================

reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'b0000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);
set local role authenticated;

update beacon.organizations set name = 'Hacked Name' where id = 'e0000000-0000-0000-0000-00000000000e';

select name as expect_still_renamed_not_hacked from beacon.organizations where id = 'e0000000-0000-0000-0000-00000000000e';

-- =============================================================================
-- Case 3: MEMBER (non-owner) cannot delete the Organization.
-- EXPECT: zero rows affected, org still exists.
-- =============================================================================

update beacon.organizations set name = name where id = 'e0000000-0000-0000-0000-00000000000e'; -- no-op, keep role context
delete from beacon.organizations where id = 'e0000000-0000-0000-0000-00000000000e';

select count(*)::int as expect_one_org_still_exists from beacon.organizations where id = 'e0000000-0000-0000-0000-00000000000e';

-- =============================================================================
-- Case 4: OWNER can delete the Organization — cascades to spaces, pages,
-- permissions, memberships, with zero orphans left behind.
-- =============================================================================

reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;

delete from beacon.organizations where id = 'e0000000-0000-0000-0000-00000000000e';

reset role;
select count(*)::int as expect_zero_orgs from beacon.organizations where id = 'e0000000-0000-0000-0000-00000000000e';
select count(*)::int as expect_zero_spaces from beacon.spaces where id = 'b0000000-0000-0000-0000-00000000000b';
select count(*)::int as expect_zero_pages from beacon.pages where id = 'c0000000-0000-0000-0000-00000000000c';
select count(*)::int as expect_zero_permissions from beacon.permissions where space_id = 'b0000000-0000-0000-0000-00000000000b';
select count(*)::int as expect_zero_memberships from beacon.organization_memberships where organization_id = 'e0000000-0000-0000-0000-00000000000e';

rollback;
