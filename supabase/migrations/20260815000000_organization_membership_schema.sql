-- Organization-level membership + invitations (org-refactor plan,
-- docs/organization-permission-structure.md). Until now `profiles` held a
-- single NOT NULL organization_id + a binary owner/member role — a strict
-- 1:1 user<->Organization model with no self-serve creation path
-- (20260813010000_organization_page_slugs.sql: "Organizations are
-- admin-created"). This migration introduces the real many-to-many
-- membership model the self-serve "create your own Organization" flow
-- requires: a user can own/belong to more than one Organization, and a new
-- Organization always starts with exactly one OWNER (its creator).
--
-- profiles.organization_id/organization_role become a non-authoritative
-- "last active Organization" convenience pointer — see
-- 20260815000100_organization_membership_gate.sql for the RLS policies that
-- stop reading them for access decisions, and
-- 20260815000300_organization_membership_backfill.sql for migrating
-- existing data into the new tables.

-- ---------------------------------------------------------------------------
-- organization_memberships
-- ---------------------------------------------------------------------------

create table beacon.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references beacon.organizations (id) on delete cascade,
  user_id uuid not null references beacon.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index organization_memberships_user_id_idx on beacon.organization_memberships (user_id);
create index organization_memberships_organization_id_idx on beacon.organization_memberships (organization_id);

-- Exactly one OWNER per Organization at a time (PROJECT ask: "OWNER must be
-- unique per org — only 1 OWNER at a time"). transfer_organization_ownership
-- (20260815000200_organization_rpcs.sql) flips old-owner->admin and
-- new-owner->owner in one statement so this index never sees two OWNER rows
-- for the same org, even transiently.
create unique index organization_memberships_one_owner_per_org
  on beacon.organization_memberships (organization_id)
  where role = 'owner';

comment on table beacon.organization_memberships is
  'Many-to-many User<->Organization membership with a per-org role. Source of truth for org access — supersedes profiles.organization_id/organization_role.';

-- ---------------------------------------------------------------------------
-- organization_invitations
-- ---------------------------------------------------------------------------

create table beacon.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references beacon.organizations (id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by_user_id uuid not null references beacon.profiles (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index organization_invitations_organization_id_idx on beacon.organization_invitations (organization_id);
create index organization_invitations_email_idx on beacon.organization_invitations (lower(email));

-- Re-inviting the same email while a PENDING invite already exists updates
-- that row instead of accumulating duplicates — mirrors
-- pending_invites_space_id_email_unique (20260814000000_invite_to_space_rpc.sql).
-- Scoped to status = 'pending' so a previously ACCEPTED/REVOKED/EXPIRED
-- invite never blocks a fresh one.
create unique index organization_invitations_org_email_pending_unique
  on beacon.organization_invitations (organization_id, lower(email))
  where status = 'pending';

comment on table beacon.organization_invitations is
  'Org-level email invitations (PENDING/ACCEPTED/EXPIRED/REVOKED). Supersedes Space-level pending_invites.';

-- ---------------------------------------------------------------------------
-- Backfill — every existing profiles row becomes an organization_memberships
-- row for its (former) single Organization, preserving 'owner'/'member' as
-- the initial per-org role. Must run in THIS migration, before the
-- organization_role column below is dropped — there is no later point at
-- which this data could still be read.
-- ---------------------------------------------------------------------------

insert into beacon.organization_memberships (organization_id, user_id, role)
select organization_id, id, organization_role
from beacon.profiles
where organization_id is not null
on conflict (organization_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- profiles — organization_id/organization_role are no longer 1:1-authoritative.
-- Dropping NOT NULL lets a brand-new signup exist with zero Organizations
-- until they create or join one; organization_role is dropped outright since
-- role is now per-membership, not a single global value (the backfill above
-- is its last reader).
-- ---------------------------------------------------------------------------

alter table beacon.profiles alter column organization_id drop not null;
alter table beacon.profiles drop column organization_role;

comment on column beacon.profiles.organization_id is
  'Convenience "last active Organization" pointer for the UI only — NOT used for access control. See organization_memberships.';

-- ---------------------------------------------------------------------------
-- Helper functions — SECURITY DEFINER so policies on organization_memberships
-- itself don't recursively re-trigger its own SELECT policy while evaluating
-- an INSERT/UPDATE/DELETE check (the exact "infinite recursion detected in
-- policy" failure mode 20260808000000_fix_permissions_bootstrap_rls_recursion.sql
-- already fixed once for permissions/spaces — same shape, same fix here: a
-- raw self-referential subquery inside a table's own policy gets re-filtered
-- by that table's SELECT policy, so it must go through a SECURITY DEFINER
-- function instead, which bypasses RLS entirely for its own internal query).
-- ---------------------------------------------------------------------------

create function beacon.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = beacon, extensions
as $$
  select exists (
    select 1 from beacon.organization_memberships
    where organization_id = p_organization_id and user_id = auth.uid()
  );
$$;

create function beacon.is_organization_owner_or_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = beacon, extensions
as $$
  select exists (
    select 1 from beacon.organization_memberships
    where organization_id = p_organization_id and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS enable + bootstrap policies
-- ---------------------------------------------------------------------------

alter table beacon.organization_memberships enable row level security;
alter table beacon.organization_invitations enable row level security;

create policy organization_memberships_select_own_orgs
  on beacon.organization_memberships for select
  to authenticated
  using (
    user_id = auth.uid()
    or beacon.is_organization_member(organization_id)
  );

-- Bootstrap clause mirrors permissions_insert_admin_or_bootstrap
-- (20260806100100_rls_policies.sql): a brand-new Organization's own creator
-- claims the founding OWNER row, and only while that Organization has zero
-- membership rows at all yet — the same chicken-and-egg break used for a
-- Space's first admin Permission row. The "zero rows yet" check is a plain
-- subquery (not the SECURITY DEFINER helper) deliberately: it must observe
-- the real, RLS-bypassed row count, and at this exact moment no rows exist
-- for the org yet regardless, so there's nothing for organization_memberships'
-- own SELECT policy to hide from the caller anyway.
create policy organization_memberships_insert_owner_or_bootstrap
  on beacon.organization_memberships for insert
  to authenticated
  with check (
    beacon.is_organization_owner_or_admin(organization_id)
    or (
      role = 'owner'
      and user_id = auth.uid()
      and not exists (
        select 1 from beacon.organization_memberships m where m.organization_id = organization_memberships.organization_id
      )
    )
  );

create policy organization_memberships_update_owner_or_admin
  on beacon.organization_memberships for update
  to authenticated
  using (beacon.is_organization_owner_or_admin(organization_id))
  with check (beacon.is_organization_owner_or_admin(organization_id));

create policy organization_memberships_delete_owner_or_admin_or_self
  on beacon.organization_memberships for delete
  to authenticated
  using (
    user_id = auth.uid()
    or beacon.is_organization_owner_or_admin(organization_id)
  );

create policy organization_invitations_all_owner_or_admin
  on beacon.organization_invitations for all
  to authenticated
  using (beacon.is_organization_owner_or_admin(organization_id))
  with check (beacon.is_organization_owner_or_admin(organization_id));

-- ---------------------------------------------------------------------------
-- organizations — self-serve creation. Was previously admin-created only
-- (no INSERT policy existed at all); any authenticated user may now create
-- their own Organization.
-- ---------------------------------------------------------------------------

create policy organizations_insert_authenticated
  on beacon.organizations for insert
  to authenticated
  with check (true);
