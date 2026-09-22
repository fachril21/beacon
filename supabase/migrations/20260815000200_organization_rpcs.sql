-- Organization invite/membership RPCs. Mirrors invite_to_space's shape
-- (20260814000000_invite_to_space_rpc.sql): SECURITY DEFINER because
-- cross-user email lookup and ownership transfer both need to act across
-- rows the caller's own RLS visibility wouldn't otherwise cover, so each
-- function re-checks the caller's own authorization in plpgsql instead of
-- relying on RLS for that part.
--
-- revoke_organization_invite has no RPC — a plain UPDATE to
-- organization_invitations.status is already covered by the
-- organization_invitations_all_owner_or_admin policy
-- (20260815000000_organization_membership_schema.sql), so the invite API
-- route just does that update directly.

-- ---------------------------------------------------------------------------
-- invite_to_organization — OWNER/ADMIN only. Existing Account by email gets
-- immediate membership; unknown email gets a PENDING organization_invitations
-- row (deduped per (org, lower(email)) while PENDING).
-- ---------------------------------------------------------------------------

create function beacon.invite_to_organization(p_organization_id uuid, p_email text, p_role text)
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

-- ---------------------------------------------------------------------------
-- accept_organization_invite — the signed-in caller accepts an invite by
-- token. Requires the caller's own profile email to match the invite's
-- email (an invite link is not a bearer credential for anyone who finds it).
-- Idempotent on an already-ACCEPTED token for the same user.
-- ---------------------------------------------------------------------------

create function beacon.accept_organization_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = beacon, extensions
as $$
declare
  v_invite beacon.organization_invitations%rowtype;
  v_caller_email text;
  v_membership beacon.organization_memberships%rowtype;
begin
  select email into v_caller_email from beacon.profiles where id = auth.uid();

  select * into v_invite from beacon.organization_invitations where token = p_token;
  if v_invite.id is null then
    raise exception 'INVITE_NOT_FOUND: no invitation matches this token' using errcode = 'P0002';
  end if;

  if v_caller_email is null or lower(v_invite.email) <> lower(v_caller_email) then
    raise exception 'INVITE_EMAIL_MISMATCH: this invitation was sent to a different email address' using errcode = '42501';
  end if;

  if v_invite.status = 'accepted' then
    select * into v_membership from beacon.organization_memberships
    where organization_id = v_invite.organization_id and user_id = auth.uid();
    return jsonb_build_object('status', 'already_accepted', 'membership', to_jsonb(v_membership));
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'INVITE_NOT_PENDING: this invitation is % and can no longer be accepted', v_invite.status using errcode = '42501';
  end if;

  if v_invite.expires_at < now() then
    update beacon.organization_invitations set status = 'expired' where id = v_invite.id;
    raise exception 'INVITE_EXPIRED: this invitation has expired' using errcode = '42501';
  end if;

  insert into beacon.organization_memberships (organization_id, user_id, role)
  values (v_invite.organization_id, auth.uid(), v_invite.role)
  on conflict (organization_id, user_id) do update set role = excluded.role
  returning * into v_membership;

  update beacon.organization_invitations set status = 'accepted', accepted_at = now() where id = v_invite.id;

  return jsonb_build_object('status', 'accepted', 'membership', to_jsonb(v_membership));
end;
$$;

-- ---------------------------------------------------------------------------
-- transfer_organization_ownership — current OWNER only. Old owner -> admin
-- and new owner -> owner happen as two UPDATEs inside one function call (one
-- implicit transaction), so organization_memberships_one_owner_per_org never
-- observes two OWNER rows for the same org at once: by the time the second
-- UPDATE runs, the first has already vacated the old owner's row.
-- ---------------------------------------------------------------------------

create function beacon.transfer_organization_ownership(p_organization_id uuid, p_new_owner_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = beacon, extensions
as $$
declare
  v_caller uuid := auth.uid();
begin
  if beacon.organization_role_for(p_organization_id) <> 'owner' then
    raise exception 'NOT_AUTHORIZED: only the current owner can transfer ownership' using errcode = '42501';
  end if;

  if p_new_owner_user_id = v_caller then
    raise exception 'ALREADY_OWNER: this user is already the owner' using errcode = '22023';
  end if;

  if not exists (
    select 1 from beacon.organization_memberships
    where organization_id = p_organization_id and user_id = p_new_owner_user_id
  ) then
    raise exception 'NOT_A_MEMBER: the target user is not a member of this Organization' using errcode = '42501';
  end if;

  update beacon.organization_memberships set role = 'admin'
  where organization_id = p_organization_id and user_id = v_caller;

  update beacon.organization_memberships set role = 'owner'
  where organization_id = p_organization_id and user_id = p_new_owner_user_id;

  return jsonb_build_object('status', 'transferred', 'newOwnerId', p_new_owner_user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- remove_organization_member — OWNER/ADMIN can remove anyone but the current
-- OWNER (must transfer first); a member can remove themselves (leave). A
-- thin RPC rather than a plain RLS-gated DELETE so the UI gets a clear,
-- distinguishable error (CANNOT_REMOVE_OWNER) instead of a silent
-- zero-rows-affected DELETE.
-- ---------------------------------------------------------------------------

create function beacon.remove_organization_member(p_organization_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = beacon, extensions
as $$
begin
  if auth.uid() <> p_user_id and not beacon.is_organization_owner_or_admin(p_organization_id) then
    raise exception 'NOT_AUTHORIZED: only an owner or admin can remove another member' using errcode = '42501';
  end if;

  if exists (
    select 1 from beacon.organization_memberships
    where organization_id = p_organization_id and user_id = p_user_id and role = 'owner'
  ) then
    raise exception 'CANNOT_REMOVE_OWNER: transfer ownership before removing the current owner' using errcode = '42501';
  end if;

  delete from beacon.organization_memberships
  where organization_id = p_organization_id and user_id = p_user_id;

  return jsonb_build_object('status', 'removed');
end;
$$;
