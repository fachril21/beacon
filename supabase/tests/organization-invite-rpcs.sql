-- Regression test for the Organization-level invite/membership RPCs
-- (docs/organization-permission-structure.md), mirroring the existing
-- invite_to_space raw-SQL test pattern (supabase/tests/space-creation-rls.sql)
-- rather than pgTAP, since pgTAP isn't installed on this local stack.
-- Written BEFORE 20260815000200_organization_rpcs.sql (TDD RED, then GREEN).
--
-- Run:
--   docker exec -i supabase_db_beacon psql -U postgres < supabase/tests/organization-invite-rpcs.sql

\set ON_ERROR_STOP off
begin;

-- =============================================================================
-- Fixtures: Org One (OWNER = A), an existing-but-unrelated Account (B, no
-- membership in Org One), and an unrelated stranger (D, MEMBER of Org One
-- with no owner/admin rights).
-- =============================================================================

insert into beacon.organizations (id, name, domain, is_domain_verified)
values ('e0000000-0000-0000-0000-00000000000e', 'Org One', null, false);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('a0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-a@example.com', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('b0000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','existing-b@example.com', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('d0000000-0000-0000-0000-00000000000d','00000000-0000-0000-0000-000000000000','authenticated','authenticated','member-d@example.com', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '');

insert into beacon.organization_memberships (organization_id, user_id, role) values
  ('e0000000-0000-0000-0000-00000000000e', 'a0000000-0000-0000-0000-00000000000a', 'owner'),
  ('e0000000-0000-0000-0000-00000000000e', 'd0000000-0000-0000-0000-00000000000d', 'member');

-- =============================================================================
-- Case 1: OWNER invites an existing Account by email -> immediate membership,
-- no organization_invitations row.
-- =============================================================================

select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;

select beacon.invite_to_organization('e0000000-0000-0000-0000-00000000000e', 'existing-b@example.com', 'member') ->> 'status'
  as expect_added;

select role as expect_member_role from beacon.organization_memberships
where organization_id = 'e0000000-0000-0000-0000-00000000000e' and user_id = 'b0000000-0000-0000-0000-00000000000b';

select count(*)::int as expect_zero_invitation_rows from beacon.organization_invitations
where organization_id = 'e0000000-0000-0000-0000-00000000000e' and lower(email) = 'existing-b@example.com';

-- =============================================================================
-- Case 2: OWNER invites an unknown email -> pending organization_invitations
-- row, role defaults to what was requested, status = pending.
-- =============================================================================

select beacon.invite_to_organization('e0000000-0000-0000-0000-00000000000e', 'brand-new@example.com', 'admin') ->> 'status'
  as expect_invited;

select status as expect_pending, role as expect_admin from beacon.organization_invitations
where organization_id = 'e0000000-0000-0000-0000-00000000000e' and lower(email) = 'brand-new@example.com';

-- =============================================================================
-- Case 3: re-inviting the same still-pending email updates the row (dedupe)
-- instead of accumulating duplicates.
-- =============================================================================

select beacon.invite_to_organization('e0000000-0000-0000-0000-00000000000e', 'brand-new@example.com', 'member') ->> 'status'
  as expect_invited_again;

select count(*)::int as expect_one_row, (array_agg(role))[1] as expect_role_updated_to_member from beacon.organization_invitations
where organization_id = 'e0000000-0000-0000-0000-00000000000e' and lower(email) = 'brand-new@example.com';

-- =============================================================================
-- Case 4: a MEMBER (non-owner, non-admin) cannot invite.
-- EXPECT: ERROR.
-- =============================================================================

reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'd0000000-0000-0000-0000-00000000000d', 'role', 'authenticated')::text, true);
set local role authenticated;

savepoint case_4;
select beacon.invite_to_organization('e0000000-0000-0000-0000-00000000000e', 'someone@example.com', 'member');
rollback to savepoint case_4;

-- =============================================================================
-- Case 5: accept_organization_invite — the invited user (once they have an
-- Account) accepts their own token -> membership created, invitation marked
-- accepted. A DIFFERENT user's token is rejected.
-- =============================================================================

reset role;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('f0000000-0000-0000-0000-00000000000f','00000000-0000-0000-0000-000000000000','authenticated','authenticated','brand-new@example.com', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '');

select token as invite_token from beacon.organization_invitations
where organization_id = 'e0000000-0000-0000-0000-00000000000e' and lower(email) = 'brand-new@example.com' \gset

-- wrong user (D) tries to accept F's invite by token -> rejected
select set_config('request.jwt.claims', json_build_object('sub', 'd0000000-0000-0000-0000-00000000000d', 'role', 'authenticated')::text, true);
set local role authenticated;
savepoint case_5_wrong_user;
select beacon.accept_organization_invite(:'invite_token');
rollback to savepoint case_5_wrong_user;

-- the actual invited user (F) accepts -> membership created, status flips
select set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-00000000000f', 'role', 'authenticated')::text, true);
set local role authenticated;

select beacon.accept_organization_invite(:'invite_token') ->> 'status' as expect_accepted;

select role as expect_member_role_f from beacon.organization_memberships
where organization_id = 'e0000000-0000-0000-0000-00000000000e' and user_id = 'f0000000-0000-0000-0000-00000000000f';

-- organization_invitations is owner/admin-only under RLS (mirrors
-- permissions_select_admin_or_self) — F, a plain member, correctly cannot
-- see this row themselves, so check as postgres (bypasses RLS) instead.
reset role;
select status as expect_invitation_accepted from beacon.organization_invitations where token = :'invite_token';

select set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-00000000000f', 'role', 'authenticated')::text, true);
set local role authenticated;

-- accepting the same (already-ACCEPTED) token again is idempotent, not an error
select beacon.accept_organization_invite(:'invite_token') ->> 'status' as expect_idempotent_accepted;

-- =============================================================================
-- Case 6: exactly-one-owner invariant under transfer_organization_ownership —
-- current OWNER (A) transfers to MEMBER D; A becomes admin, D becomes owner,
-- in one atomic call.
-- =============================================================================

reset role;
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;

select beacon.transfer_organization_ownership('e0000000-0000-0000-0000-00000000000e', 'd0000000-0000-0000-0000-00000000000d') ->> 'status'
  as expect_transferred;

select role as expect_a_is_now_admin from beacon.organization_memberships
where organization_id = 'e0000000-0000-0000-0000-00000000000e' and user_id = 'a0000000-0000-0000-0000-00000000000a';

select role as expect_d_is_now_owner from beacon.organization_memberships
where organization_id = 'e0000000-0000-0000-0000-00000000000e' and user_id = 'd0000000-0000-0000-0000-00000000000d';

-- A (no longer owner) cannot transfer again.
savepoint case_6_stale_owner;
select beacon.transfer_organization_ownership('e0000000-0000-0000-0000-00000000000e', 'b0000000-0000-0000-0000-00000000000b');
rollback to savepoint case_6_stale_owner;

-- =============================================================================
-- Case 7: remove_organization_member cannot remove the current OWNER.
-- =============================================================================

savepoint case_7;
select beacon.remove_organization_member('e0000000-0000-0000-0000-00000000000e', 'd0000000-0000-0000-0000-00000000000d');
rollback to savepoint case_7;

rollback;
