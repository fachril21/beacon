-- ---------------------------------------------------------------------------
-- Organization members automatically get access to every Space/Page in their
-- Organization. Space-level invites are gone; org membership is the only
-- door in.
--
-- Effective Space role = the HIGHEST of
--   * the org-derived role (owner/admin -> 'admin', member -> 'editor'), and
--   * any explicit beacon.permissions row for that Space.
-- Org membership is a floor: a stale 'viewer' row can never lock an org admin
-- out. Non-members always get NULL (the org gate), even with a stale row.
--
-- Mirror of useSpaceRole in src/hooks/use-spaces.ts — keep both in sync.
-- Safe to run more than once (create or replace).
-- ---------------------------------------------------------------------------

create or replace function beacon.user_space_role(p_space_id uuid)
returns text
language sql
stable
security definer
set search_path = beacon, extensions
as $$
  with org_role as (
    select case when om.role in ('owner', 'admin') then 'admin' else 'editor' end as role
    from beacon.spaces s
    join beacon.organization_memberships om on om.organization_id = s.organization_id
    where s.id = p_space_id and om.user_id = auth.uid()
  ),
  explicit_role as (
    select p.role
    from beacon.permissions p
    where p.space_id = p_space_id and p.user_id = auth.uid()
  )
  select r.role
  from (
    select role from org_role
    union all
    select role from explicit_role where exists (select 1 from org_role)
  ) r
  order by case r.role when 'admin' then 2 when 'editor' then 1 else 0 end desc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- list_space_members (used by the @mention picker): every member of the
-- Space's Organization is a member of the Space now, not just users with a
-- beacon.permissions row. Same return shape and display-name rule as
-- 20260930000200_list_space_members_full_email.sql.
-- ---------------------------------------------------------------------------

create or replace function beacon.list_space_members(p_space_id uuid)
returns table (user_id uuid, name text, role text)
language sql
stable
security definer
set search_path = beacon, extensions
as $$
  select
    om.user_id,
    coalesce(nullif(btrim(pr.name), ''), nullif(btrim(pr.email), ''), 'Pengguna') as name,
    case
      when om.role in ('owner', 'admin') or ep.role = 'admin' then 'admin'
      else 'editor' -- org membership floors every member at editor
    end as role
  from beacon.spaces s
  join beacon.organization_memberships om on om.organization_id = s.organization_id
  join beacon.profiles pr on pr.id = om.user_id
  left join beacon.permissions ep on ep.space_id = s.id and ep.user_id = om.user_id
  where s.id = p_space_id
    and beacon.user_space_role(p_space_id) is not null
  order by 2;
$$;

revoke all on function beacon.list_space_members(uuid) from public, anon;
grant execute on function beacon.list_space_members(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- invite_to_organization: an existing member's role used to be overwritten by
-- `on conflict do update`, so an admin re-inviting the OWNER's email with role
-- 'member' demoted them and left the Organization ownerless (the one-owner
-- unique index only forbids TWO owners). The owner's role may change only via
-- transfer_organization_ownership. Otherwise identical to
-- 20260815000200_organization_rpcs.sql.
-- ---------------------------------------------------------------------------

create or replace function beacon.invite_to_organization(p_organization_id uuid, p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = beacon, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_profile_id uuid;
  v_membership beacon.organization_memberships%rowtype;
  v_invite beacon.organization_invitations%rowtype;
begin
  if not beacon.is_organization_owner_or_admin(p_organization_id) then
    raise exception 'NOT_AUTHORIZED: only an Organization owner or admin can invite members' using errcode = '42501';
  end if;

  if p_role not in ('admin', 'member') then
    raise exception 'INVALID_ROLE: % cannot be granted directly via invite', p_role using errcode = '22023';
  end if;

  select id into v_profile_id from beacon.profiles where lower(email) = v_email;

  if v_profile_id is not null then
    if exists (
      select 1 from beacon.organization_memberships
      where organization_id = p_organization_id and user_id = v_profile_id and role = 'owner'
    ) then
      raise exception 'CANNOT_CHANGE_OWNER: the owner''s role can only change via ownership transfer' using errcode = '42501';
    end if;

    insert into beacon.organization_memberships (organization_id, user_id, role)
    values (p_organization_id, v_profile_id, p_role)
    on conflict (organization_id, user_id) do update set role = excluded.role
    returning * into v_membership;

    return jsonb_build_object('status', 'added', 'membership', to_jsonb(v_membership));
  end if;

  insert into beacon.organization_invitations (organization_id, email, role, invited_by_user_id)
  values (p_organization_id, v_email, p_role, auth.uid())
  on conflict (organization_id, lower(email)) where status = 'pending'
  do update set role = excluded.role, invited_by_user_id = excluded.invited_by_user_id, created_at = now(), expires_at = now() + interval '7 days'
  returning * into v_invite;

  return jsonb_build_object('status', 'invited', 'invite', to_jsonb(v_invite));
end;
$$;
