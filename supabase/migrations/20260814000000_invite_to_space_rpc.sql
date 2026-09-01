-- Completes Space collaboration invites (PRD.md Flow 7 step 4). Until now,
-- inviting by email only ever wrote a pending_invites row, which is only
-- ever consumed by handle_new_user (20260806100100_rls_policies.sql) — a
-- trigger that fires exclusively on a brand-new auth.users signup. An
-- invited email that already has an Account (the common case: inviting an
-- existing teammate to a new Space) had no path to ever gain access —
-- pending_invites RLS restricts SELECT to the inviting Space's admins, so
-- the invited person couldn't even discover the invite existed.
--
-- invite_to_space() closes that gap: an existing same-Organization Account
-- is granted the Permission immediately; a cross-Organization email is
-- rejected outright (it could never complete — profiles.organization_id is
-- set once at signup and never changes); an unknown email keeps today's
-- pending_invites path, now deduplicated per (space_id, lower(email)) so
-- re-inviting refreshes the row instead of accumulating duplicates.

-- ---------------------------------------------------------------------------
-- pending_invites dedup — re-inviting the same email to the same Space
-- updates the existing row (fresh role/inviter/timestamp) instead of piling
-- up duplicates that would all separately resolve on signup.
-- ---------------------------------------------------------------------------

create unique index pending_invites_space_id_email_unique
  on beacon.pending_invites (space_id, lower(email));

-- ---------------------------------------------------------------------------
-- invite_to_space — SECURITY DEFINER because the existing-Account lookup
-- must see profiles across every Organization (profiles_select_same_organization
-- RLS would otherwise hide any email outside the caller's own Organization,
-- which is exactly the case this function needs to detect and reject). Since
-- SECURITY DEFINER bypasses RLS entirely, the function opens by re-checking
-- the caller's own admin role on p_space_id itself — the same guard
-- permissions_insert_admin_or_bootstrap's RLS clause would apply, just
-- enforced in plpgsql instead of a policy.
-- ---------------------------------------------------------------------------

create function beacon.invite_to_space(p_space_id uuid, p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = beacon, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_space_org_id uuid;
  v_profile_id uuid;
  v_profile_org_id uuid;
  v_permission beacon.permissions%rowtype;
  v_invite beacon.pending_invites%rowtype;
begin
  if not beacon.space_role_at_least(p_space_id, 'admin') then
    raise exception 'NOT_AUTHORIZED: only a Space admin can invite members' using errcode = '42501';
  end if;

  select organization_id into v_space_org_id from beacon.spaces where id = p_space_id;

  select id, organization_id into v_profile_id, v_profile_org_id
  from beacon.profiles where lower(email) = v_email;

  if v_profile_id is not null then
    if v_profile_org_id <> v_space_org_id then
      raise exception 'EMAIL_BELONGS_TO_ANOTHER_ORGANIZATION: % is registered under a different Organization', p_email;
    end if;

    insert into beacon.permissions (space_id, user_id, role)
    values (p_space_id, v_profile_id, p_role)
    on conflict (space_id, user_id) do update set role = excluded.role
    returning * into v_permission;

    return jsonb_build_object('status', 'added', 'permission', to_jsonb(v_permission));
  end if;

  insert into beacon.pending_invites (space_id, email, role, invited_by_user_id)
  values (p_space_id, v_email, p_role, auth.uid())
  on conflict (space_id, lower(email))
  do update set role = excluded.role, invited_by_user_id = excluded.invited_by_user_id, created_at = now()
  returning * into v_invite;

  return jsonb_build_object('status', 'invited', 'invite', to_jsonb(v_invite));
end;
$$;
