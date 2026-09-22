-- Moves the entire app schema from the default `public` namespace to a
-- dedicated `beacon` schema. `NEXT_PUBLIC_SUPABASE_SCHEMA=beacon` has already
-- been added to the app's env config; this migration is the database-side
-- half of that cutover. Full cutover, beacon-only — no compatibility `public`
-- schema is left behind, and no transition period where both are exposed.
--
-- Applied directly against the live project (no staging clone available for
-- this cutover) — every function below is a verbatim copy of its current
-- live body (cross-checked against every migration that ever touched it, in
-- order, taking the latest `create or replace` for anything altered more
-- than once), with only `public.` -> `beacon.` schema-qualification changed,
-- plus explicit `search_path` pinning added to the handful of trigger
-- functions that never had one.
--
-- Technical approach and why it's two steps, not one:
--
-- 1. `alter schema public rename to beacon` is a single atomic, OID-preserving
--    rename. Every table, index, FK, sequence, trigger, and RLS policy in
--    Postgres is tracked by OID, not by schema name, so this one statement
--    is enough by itself to keep every `create policy ... using (...)`
--    clause, every foreign key, every trigger attachment, and every
--    composite-type return (e.g. `returns public.pages`) working correctly
--    against the renamed schema. None of those need to be touched here.
--
-- 2. That does NOT fix PL/pgSQL/SQL function BODIES. A function's body is
--    stored as literal source text (`prosrc`), re-resolved fresh via normal
--    catalog lookup + search_path every time it's called — it is not
--    pre-bound to OIDs the way a view or an RLS policy expression is. Every
--    function below whose body says `public.something` would start failing
--    at runtime the moment step 1 lands, because `public` no longer exists.
--    So every live function is reissued via `create or replace function`
--    with its body's `public.` references rewritten to `beacon.`.
--
--    `create or replace function` preserves the function's OID, owner, and
--    existing GRANTs (Postgres: "the ownership and permissions of the
--    function do not change" on CREATE OR REPLACE) — so none of the
--    existing `grant execute on function ...` statements from earlier
--    migrations need to be reissued here. Table-level GRANTs are similarly
--    OID-keyed and are entirely unaffected by the schema rename in step 1.
--
-- Functions intentionally NOT reissued (their bodies contain no `public.`
-- qualification to rewrite, so the plain schema rename in step 1 already
-- moves them correctly with zero further changes needed):
--   - set_updated_at() — body only touches NEW/OLD, no table/function refs.
--
-- Objects intentionally excluded entirely (dropped by a later migration,
-- never live at the same time as this one runs):
--   - table public.pending_invites (dropped 20260815000300)
--   - function public.current_profile_organization_id() (dropped 20260815000100)
--   - function public.current_profile_organization_role() (dropped 20260815000100)
--   - function public.invite_to_space(uuid, text, text) (dropped 20260815000300)
--
-- One deliberate addition beyond a mechanical rename: organizations_set_slug,
-- pages_set_organization_id, and spaces_set_slug never had an explicit
-- `set search_path` (they predate that pattern being applied consistently).
-- They're pinned to `beacon` here too, matching this codebase's existing
-- search_path-hardening discipline for every other function. slugify() is
-- pinned to `beacon, extensions` defensively, since it calls the `unaccent`
-- extension function unqualified — see the report accompanying this
-- migration for why that one schema is a genuine, not-fully-verifiable-from-
-- migration-files-alone uncertainty.

alter schema public rename to beacon;

-- ---------------------------------------------------------------------------
-- user_space_role / space_role_at_least / page_space_id
-- (20260806100100_rls_policies.sql; user_space_role's body is the version
-- from 20260815000100_organization_membership_gate.sql, its only recreate)
-- ---------------------------------------------------------------------------

create or replace function beacon.user_space_role(p_space_id uuid)
returns text
language sql
stable
security definer
set search_path = beacon
as $$
  select p.role
  from beacon.permissions p
  join beacon.spaces s on s.id = p.space_id
  where p.space_id = p_space_id
    and p.user_id = auth.uid()
    and exists (
      select 1 from beacon.organization_memberships om
      where om.organization_id = s.organization_id and om.user_id = auth.uid()
    );
$$;

create or replace function beacon.space_role_at_least(p_space_id uuid, p_min_role text)
returns boolean
language sql
stable
security definer
set search_path = beacon
as $$
  select case beacon.user_space_role(p_space_id)
    when 'admin' then true
    when 'editor' then p_min_role in ('viewer', 'editor')
    when 'viewer' then p_min_role = 'viewer'
    else false
  end;
$$;

create or replace function beacon.page_space_id(p_page_id uuid)
returns uuid
language sql
stable
security definer
set search_path = beacon
as $$
  select space_id from beacon.pages where id = p_page_id;
$$;

-- ---------------------------------------------------------------------------
-- handle_new_user (final body: 20260815000100_organization_membership_gate.sql
-- — no longer touches pending_invites at all)
-- ---------------------------------------------------------------------------

create or replace function beacon.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = beacon
as $$
begin
  insert into beacon.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', '')
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Publishing RPCs (20260806100200_publishing_rpcs.sql; publish_page's body
-- is the version from 20260813010000_organization_page_slugs.sql, its only
-- recreate — adds slug assignment)
-- ---------------------------------------------------------------------------

create or replace function beacon.build_published_snapshot(p_page_id uuid, p_published_at timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = beacon
as $$
  select jsonb_build_object(
    'title', p.title,
    'content', p.content,
    'publishedAt', p_published_at,
    'screenshotBlocks', coalesce(
      (
        select jsonb_object_agg(
          sb.id::text,
          jsonb_build_object(
            'id', sb.id,
            'pageId', sb.page_id,
            'type', 'screenshot',
            'order', sb."order",
            'imageUrl', sb.image_object_key,
            'imageWidth', sb.image_width,
            'imageHeight', sb.image_height,
            'annotationJson', sb.annotation_json,
            'description', sb.description,
            'altText', sb.alt_text,
            'createdAt', sb.created_at,
            'updatedAt', sb.updated_at
          )
        )
        from beacon.screenshot_blocks sb
        where sb.page_id = p_page_id
      ),
      '{}'::jsonb
    )
  )
  from beacon.pages p
  where p.id = p_page_id;
$$;

create or replace function beacon.publish_page(p_page_id uuid)
returns beacon.pages
language plpgsql
security invoker
set search_path = beacon
as $$
declare
  v_published_at timestamptz := now();
  v_page beacon.pages;
  v_base_slug text;
  v_candidate text;
  v_n int := 1;
  v_organization_id uuid;
  v_existing_slug text;
begin
  select organization_id, slug into v_organization_id, v_existing_slug
  from beacon.pages where id = p_page_id;

  if v_existing_slug is null then
    select title into v_base_slug from beacon.pages where id = p_page_id;
    v_base_slug := beacon.slugify(coalesce(nullif(trim(v_base_slug), ''), 'untitled'));
    v_candidate := v_base_slug;
    while exists (
      select 1 from beacon.pages
      where organization_id = v_organization_id and slug = v_candidate and id <> p_page_id
    ) loop
      v_n := v_n + 1;
      v_candidate := v_base_slug || '-' || v_n;
    end loop;
  else
    v_candidate := v_existing_slug;
  end if;

  update beacon.pages
  set is_published = true,
      published_at = v_published_at,
      published_content_snapshot = beacon.build_published_snapshot(p_page_id, v_published_at),
      slug = v_candidate
  where id = p_page_id
  returning * into v_page;

  return v_page;
end;
$$;

create or replace function beacon.update_published_page(p_page_id uuid)
returns beacon.pages
language plpgsql
security invoker
set search_path = beacon
as $$
declare
  v_published_at timestamptz := now();
  v_page beacon.pages;
begin
  update beacon.pages
  set published_at = v_published_at,
      published_content_snapshot = beacon.build_published_snapshot(p_page_id, v_published_at)
  where id = p_page_id and is_published = true
  returning * into v_page;

  return v_page;
end;
$$;

create or replace function beacon.unpublish_page(p_page_id uuid)
returns beacon.pages
language plpgsql
security invoker
set search_path = beacon
as $$
declare
  v_page beacon.pages;
begin
  update beacon.pages
  set is_published = false
  where id = p_page_id
  returning * into v_page;

  return v_page;
end;
$$;

-- ---------------------------------------------------------------------------
-- feedback_rate_limit_ok (final body: 20260807000200_fix_feedback_rate_limit_ip_parsing.sql)
-- ---------------------------------------------------------------------------

create or replace function beacon.feedback_rate_limit_ok(
  p_page_id uuid,
  p_max_per_window int default 3,
  p_window_minutes int default 60
)
returns boolean
language plpgsql
security definer
set search_path = beacon
as $$
declare
  v_ip inet;
  v_window_start timestamptz;
  v_count int;
begin
  begin
    v_ip := nullif(
      trim(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1)),
      ''
    )::inet;
  exception when others then
    v_ip := null;
  end;

  if v_ip is null then
    return true;
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / (p_window_minutes * 60)) * (p_window_minutes * 60));

  insert into beacon.feedback_rate_limits (page_id, ip_address, window_start, count)
  values (p_page_id, v_ip, v_window_start, 1)
  on conflict (page_id, ip_address, window_start)
  do update set count = feedback_rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_max_per_window;
end;
$$;

-- ---------------------------------------------------------------------------
-- is_space_creator (20260808000000_fix_permissions_bootstrap_rls_recursion.sql)
-- ---------------------------------------------------------------------------

create or replace function beacon.is_space_creator(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = beacon
as $$
  select exists (
    select 1 from beacon.spaces s
    where s.id = p_space_id and s.created_by_user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- slugify (20260813010000_organization_page_slugs.sql) — no `public.` refs
-- in the body itself, but it calls the unaccent extension function
-- unqualified; pinned defensively to `beacon, extensions` (see header note).
-- ---------------------------------------------------------------------------

create or replace function beacon.slugify(p_text text)
returns text
language sql
immutable
set search_path = beacon, extensions
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(unaccent(p_text)), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'untitled'
  );
$$;

-- ---------------------------------------------------------------------------
-- organizations_set_slug / pages_set_organization_id / spaces_set_slug
-- (20260813010000_organization_page_slugs.sql, 20260817000000_space_slugs.sql)
-- — none had an explicit search_path before; pinned to `beacon` here.
-- ---------------------------------------------------------------------------

create or replace function beacon.organizations_set_slug()
returns trigger
language plpgsql
set search_path = beacon
as $$
declare
  base_slug text;
  candidate text;
  n int := 1;
begin
  if new.slug is not null then
    return new;
  end if;

  base_slug := beacon.slugify(new.name);
  candidate := base_slug;
  while exists (select 1 from beacon.organizations where slug = candidate and id <> new.id) loop
    n := n + 1;
    candidate := base_slug || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

create or replace function beacon.pages_set_organization_id()
returns trigger
language plpgsql
set search_path = beacon
as $$
begin
  select s.organization_id into new.organization_id
  from beacon.spaces s
  where s.id = new.space_id;
  return new;
end;
$$;

create or replace function beacon.spaces_set_slug()
returns trigger
language plpgsql
set search_path = beacon
as $$
declare
  base_slug text;
  candidate text;
  n int := 1;
begin
  if new.slug is not null then
    return new;
  end if;

  base_slug := beacon.slugify(new.name);
  candidate := base_slug;
  while exists (
    select 1 from beacon.spaces
    where organization_id = new.organization_id and slug = candidate and id <> new.id
  ) loop
    n := n + 1;
    candidate := base_slug || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- check_domain_verification_rate_limit (final body:
-- 20260815000100_organization_membership_gate.sql — uses is_organization_member
-- instead of the now-dropped current_profile_organization_id)
-- ---------------------------------------------------------------------------

create or replace function beacon.check_domain_verification_rate_limit(
  p_organization_id uuid,
  p_max_per_window int default 5,
  p_window_minutes int default 10
)
returns boolean
language plpgsql
security definer
set search_path = beacon
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  if not beacon.is_organization_member(p_organization_id) then
    return false;
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / (p_window_minutes * 60)) * (p_window_minutes * 60));

  insert into beacon.domain_verification_attempts (organization_id, window_start, count)
  values (p_organization_id, v_window_start, 1)
  on conflict (organization_id, window_start)
  do update set count = domain_verification_attempts.count + 1
  returning count into v_count;

  return v_count <= p_max_per_window;
end;
$$;

-- ---------------------------------------------------------------------------
-- is_organization_member / is_organization_owner_or_admin / organization_role_for
-- (20260815000000_organization_membership_schema.sql, 20260815000100_organization_membership_gate.sql)
-- ---------------------------------------------------------------------------

create or replace function beacon.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = beacon
as $$
  select exists (
    select 1 from beacon.organization_memberships
    where organization_id = p_organization_id and user_id = auth.uid()
  );
$$;

create or replace function beacon.is_organization_owner_or_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = beacon
as $$
  select exists (
    select 1 from beacon.organization_memberships
    where organization_id = p_organization_id and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create or replace function beacon.organization_role_for(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = beacon
as $$
  select role from beacon.organization_memberships
  where organization_id = p_organization_id and user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- permissions_require_org_membership (20260815000100_organization_membership_gate.sql)
-- ---------------------------------------------------------------------------

create or replace function beacon.permissions_require_org_membership()
returns trigger
language plpgsql
security definer
set search_path = beacon
as $$
declare
  v_organization_id uuid;
begin
  select organization_id into v_organization_id from beacon.spaces where id = new.space_id;

  if not exists (
    select 1 from beacon.organization_memberships
    where organization_id = v_organization_id and user_id = new.user_id
  ) then
    raise exception 'NOT_ORGANIZATION_MEMBER: user is not a member of this Space''s Organization' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organization invite/membership RPCs (20260815000200_organization_rpcs.sql)
-- ---------------------------------------------------------------------------

create or replace function beacon.invite_to_organization(p_organization_id uuid, p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = beacon
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

create or replace function beacon.accept_organization_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = beacon
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

create or replace function beacon.transfer_organization_ownership(p_organization_id uuid, p_new_owner_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = beacon
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

create or replace function beacon.remove_organization_member(p_organization_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = beacon
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
