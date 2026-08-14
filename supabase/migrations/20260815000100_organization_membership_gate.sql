-- The org-membership access gate. Modifies the ONE helper function every
-- Space/Page/ScreenshotBlock/Version/Comment RLS policy already routes
-- through (public.user_space_role, 20260806100100_rls_policies.sql) so org
-- membership becomes a prerequisite for all of them at once, instead of
-- duplicating the check across a dozen individual policies.
--
-- Also replaces the two helpers that assumed a single organization_id per
-- profile (current_profile_organization_id/current_profile_organization_role
-- — both now stale after profiles.organization_role was dropped in
-- 20260815000000_organization_membership_schema.sql) with
-- organization_memberships-backed equivalents. is_organization_member itself
-- was already introduced in that migration (needed early, by its own bootstrap
-- policies) — only organization_role_for is new here.
-- ---------------------------------------------------------------------------

create function public.organization_role_for(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.organization_memberships
  where organization_id = p_organization_id and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- THE GATE: user_space_role now returns null (no access) for anyone who
-- isn't an organization_memberships member of the Space's own Organization,
-- even if a Permission row still exists for them (e.g. removed from the org
-- without their Space permissions being cleaned up first — the write-time
-- trigger below prevents new rows like that, but this covers stale ones and
-- any other bypass). Every downstream policy that calls user_space_role or
-- space_role_at_least — spaces, permissions, pages, screenshot_blocks,
-- versions, comments — is gated by this one change.
-- ---------------------------------------------------------------------------

create or replace function public.user_space_role(p_space_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.permissions p
  join public.spaces s on s.id = p.space_id
  where p.space_id = p_space_id
    and p.user_id = auth.uid()
    and exists (
      select 1 from public.organization_memberships om
      where om.organization_id = s.organization_id and om.user_id = auth.uid()
    );
$$;

-- ---------------------------------------------------------------------------
-- Write-time guard: a Permission row may only ever be created/reassigned for
-- someone who is already an org member of the Space's Organization — Space
-- access no longer has its own independent invite path (org membership is a
-- prerequisite, not just a read-time filter).
-- ---------------------------------------------------------------------------

create function public.permissions_require_org_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  select organization_id into v_organization_id from public.spaces where id = new.space_id;

  if not exists (
    select 1 from public.organization_memberships
    where organization_id = v_organization_id and user_id = new.user_id
  ) then
    raise exception 'NOT_ORGANIZATION_MEMBER: user is not a member of this Space''s Organization' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger permissions_require_org_membership_trigger
  before insert or update on public.permissions
  for each row execute function public.permissions_require_org_membership();

-- ---------------------------------------------------------------------------
-- spaces — creation now requires org membership (any role), not equality
-- with a single profiles.organization_id.
-- ---------------------------------------------------------------------------

drop policy spaces_insert_own_organization on public.spaces;

create policy spaces_insert_own_organization
  on public.spaces for insert
  to authenticated
  with check (public.is_organization_member(organization_id));

-- ---------------------------------------------------------------------------
-- profiles — visible to yourself, or to anyone who shares at least one
-- Organization with you (Members lists, @mention pickers now span every
-- shared org, not a single one).
-- ---------------------------------------------------------------------------

drop policy profiles_select_same_organization on public.profiles;

create policy profiles_select_shared_organization
  on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.organization_memberships mine
      join public.organization_memberships theirs
        on theirs.organization_id = mine.organization_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

-- ---------------------------------------------------------------------------
-- organizations — UPDATE (domain settings) restricted to that org's OWNER.
-- ---------------------------------------------------------------------------

drop policy organizations_update_owner_only on public.organizations;

create policy organizations_update_owner_only
  on public.organizations for update
  to authenticated
  using (public.organization_role_for(id) = 'owner')
  with check (public.organization_role_for(id) = 'owner');

-- current_profile_organization_id/current_profile_organization_role assumed
-- a single Organization per profile and are superseded by the two functions
-- above. check_domain_verification_rate_limit (20260813000000) is the one
-- other caller — redefined here (new migration, not editing the historical
-- file, per this repo's existing convention for already-applied migrations,
-- e.g. 20260812010000_fix_permissions_bootstrap_column_shadowing.sql) to use
-- is_organization_member instead before the two helpers are dropped.

create or replace function public.check_domain_verification_rate_limit(
  p_organization_id uuid,
  p_max_per_window int default 5,
  p_window_minutes int default 10
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  if not public.is_organization_member(p_organization_id) then
    return false;
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / (p_window_minutes * 60)) * (p_window_minutes * 60));

  insert into public.domain_verification_attempts (organization_id, window_start, count)
  values (p_organization_id, v_window_start, 1)
  on conflict (organization_id, window_start)
  do update set count = domain_verification_attempts.count + 1
  returning count into v_count;

  return v_count <= p_max_per_window;
end;
$$;

drop function public.current_profile_organization_id();
drop function public.current_profile_organization_role();

-- ---------------------------------------------------------------------------
-- handle_new_user — previously auto-assigned every new signup into whichever
-- Organization a matching Space-level pending_invites row pointed at, or
-- else the single earliest-created Organization as a fallback (the "real
-- multi-org self-serve signup is out of v1 scope" note this whole refactor
-- closes). Org assignment is no longer the signup trigger's job at all: a
-- brand-new profile starts with zero Organizations, and joining one happens
-- explicitly via accept_organization_invite (20260815000200_organization_rpcs.sql)
-- — called right after email verification when signup carried an invite
-- token, or whenever an invite link is opened by an already-registered user.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', '')
  );

  return new;
end;
$$;
