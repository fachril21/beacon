-- Organization invites now always require the invited person to confirm via
-- email before joining, unless they're already a member of this same
-- Organization (in which case there's nothing to confirm — re-inviting them
-- is really just a role change, and remains the only "change role" UI that
-- exists for Organization members today).
--
-- Previously, invite_to_organization added ANY existing Beacon Account
-- (a matching beacon.profiles row) to the Organization immediately, with no
-- confirmation step and no notification distinct from silently appearing in
-- the Members list. Only a brand-new email (no Account at all) went through
-- the pending organization_invitations + email flow. Now: only an email that
-- already belongs to a CURRENT member of this Organization gets the instant
-- role-update path; every other case (no Account yet, or an Account that
-- exists but isn't a member of this Organization yet) creates a pending
-- invitation and must be accepted via accept_organization_invite, same as
-- the brand-new-email case always has.
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
    select * into v_membership from beacon.organization_memberships
    where organization_id = p_organization_id and user_id = v_profile_id;

    -- Already a member of THIS Organization: treat as a role change, applied
    -- instantly, exactly like before -- there's no new membership to confirm.
    if v_membership.user_id is not null then
      update beacon.organization_memberships set role = p_role
      where organization_id = p_organization_id and user_id = v_profile_id
      returning * into v_membership;

      return jsonb_build_object('status', 'added', 'membership', to_jsonb(v_membership));
    end if;
  end if;

  insert into beacon.organization_invitations (organization_id, email, role, invited_by_user_id)
  values (p_organization_id, v_email, p_role, auth.uid())
  on conflict (organization_id, lower(email)) where status = 'pending'
  do update set role = excluded.role, invited_by_user_id = excluded.invited_by_user_id, created_at = now(), expires_at = now() + interval '7 days'
  returning * into v_invite;

  return jsonb_build_object('status', 'invited', 'invite', to_jsonb(v_invite));
end;
$$;
