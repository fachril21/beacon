-- Retires the Space-level email-invite path now that Organization-level
-- invites exist (20260815000200_organization_rpcs.sql). Bringing a brand
-- new person into Beacon at all now goes exclusively through an
-- Organization invite; Space-level access (public.permissions) only ever
-- grants existing Organization members going forward, via a roster picker,
-- not a second independent email flow — see
-- docs/organization-permission-structure.md.
--
-- Any still-PENDING pending_invites row is migrated forward into
-- organization_invitations rather than silently discarded (no data loss),
-- with one unavoidable scope narrowing: a Space-level invite carried a
-- SpaceRole (viewer/editor/admin scoped to one Space); an Organization
-- invite only ever grants a baseline org role. Every migrated row becomes
-- role='member' at the org level — the inviting admin grants the actual
-- Space-level role separately, after the person has joined the
-- Organization, via the Space Members roster picker.

-- ---------------------------------------------------------------------------
-- Migrate forward. Dedups the same way organization_invitations already
-- enforces (one PENDING row per (org, lower(email))) — an email invited to
-- two different Spaces in the same Organization collapses to one
-- Organization-level invite, which is the correct outcome (they only need
-- to join the org once).
-- ---------------------------------------------------------------------------

insert into public.organization_invitations (organization_id, email, role, invited_by_user_id, status, created_at)
select distinct on (s.organization_id, lower(pi.email))
  s.organization_id,
  lower(pi.email),
  'member',
  pi.invited_by_user_id,
  'pending',
  pi.created_at
from public.pending_invites pi
join public.spaces s on s.id = pi.space_id
order by s.organization_id, lower(pi.email), pi.created_at desc
on conflict (organization_id, lower(email)) where status = 'pending' do nothing;

-- ---------------------------------------------------------------------------
-- Retire the old path. handle_new_user no longer consumes pending_invites
-- (20260815000100_organization_membership_gate.sql already stopped calling
-- it); nothing else references either object after this point.
-- ---------------------------------------------------------------------------

drop function public.invite_to_space(uuid, text, text);
drop policy if exists pending_invites_admin_only on public.pending_invites;
drop table public.pending_invites;
