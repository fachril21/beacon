-- RLS policies for the schema in 20260806100000_initial_schema.sql
-- (PRD.md Epic 9, US9.2/US9.3). Every table has RLS enabled with no default
-- access — access exists only through the policies below, so "forgot a
-- WHERE clause" is not a way to leak data (PROJECT.md §9.5).

alter table beacon.organizations enable row level security;
alter table beacon.profiles enable row level security;
alter table beacon.spaces enable row level security;
alter table beacon.permissions enable row level security;
alter table beacon.pending_invites enable row level security;
alter table beacon.pages enable row level security;
alter table beacon.screenshot_blocks enable row level security;
alter table beacon.versions enable row level security;
alter table beacon.comments enable row level security;
alter table beacon.feedback enable row level security;

-- ---------------------------------------------------------------------------
-- Helper functions — SECURITY DEFINER so policies that call them don't
-- recursively re-trigger RLS on profiles/permissions (which would either
-- infinite-loop or silently return no rows depending on caller). Each pins
-- search_path per Postgres's SECURITY DEFINER hardening guidance.
-- ---------------------------------------------------------------------------

create function beacon.current_profile_organization_id()
returns uuid
language sql
stable
security definer
set search_path = beacon, extensions
as $$
  select organization_id from beacon.profiles where id = auth.uid();
$$;

create function beacon.current_profile_organization_role()
returns text
language sql
stable
security definer
set search_path = beacon, extensions
as $$
  select organization_role from beacon.profiles where id = auth.uid();
$$;

create function beacon.user_space_role(p_space_id uuid)
returns text
language sql
stable
security definer
set search_path = beacon, extensions
as $$
  select role from beacon.permissions
  where space_id = p_space_id and user_id = auth.uid();
$$;

-- viewer < editor < admin, used by "at least this role" checks below.
create function beacon.space_role_at_least(p_space_id uuid, p_min_role text)
returns boolean
language sql
stable
security definer
set search_path = beacon, extensions
as $$
  select case beacon.user_space_role(p_space_id)
    when 'admin' then true
    when 'editor' then p_min_role in ('viewer', 'editor')
    when 'viewer' then p_min_role = 'viewer'
    else false
  end;
$$;

create function beacon.page_space_id(p_page_id uuid)
returns uuid
language sql
stable
security definer
set search_path = beacon, extensions
as $$
  select space_id from beacon.pages where id = p_page_id;
$$;

-- ---------------------------------------------------------------------------
-- Organization — publicly readable (domain names aren't sensitive, and the
-- Host-header middleware in Epic 14a needs an anonymous lookup on every
-- request); only that org's owner can write.
-- ---------------------------------------------------------------------------

create policy organizations_select_public
  on beacon.organizations for select
  to anon, authenticated
  using (true);

create policy organizations_update_owner_only
  on beacon.organizations for update
  to authenticated
  using (
    id = beacon.current_profile_organization_id()
    and beacon.current_profile_organization_role() = 'owner'
  )
  with check (
    id = beacon.current_profile_organization_id()
    and beacon.current_profile_organization_role() = 'owner'
  );

-- ---------------------------------------------------------------------------
-- profiles — internal only; readable within one's own Organization (needed
-- for Members lists and @mention pickers), never by anon.
-- ---------------------------------------------------------------------------

create policy profiles_select_same_organization
  on beacon.profiles for select
  to authenticated
  using (organization_id = beacon.current_profile_organization_id());

create policy profiles_update_self
  on beacon.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Row creation happens exclusively via the handle_new_user trigger
-- (SECURITY DEFINER, runs as the migration owner) — no direct INSERT policy.

-- ---------------------------------------------------------------------------
-- Space — sidebar visibility mirrors useUserSpaces (explicit Permission row);
-- public TOC visibility requires is_publishable (Flow 5 step 1).
-- ---------------------------------------------------------------------------

create policy spaces_select_public_publishable
  on beacon.spaces for select
  to anon
  using (is_publishable = true);

create policy spaces_select_member_or_publishable
  on beacon.spaces for select
  to authenticated
  using (
    is_publishable = true
    or beacon.user_space_role(id) is not null
  );

create policy spaces_insert_own_organization
  on beacon.spaces for insert
  to authenticated
  with check (organization_id = beacon.current_profile_organization_id());

create policy spaces_update_admin_only
  on beacon.spaces for update
  to authenticated
  using (beacon.space_role_at_least(id, 'admin'))
  with check (beacon.space_role_at_least(id, 'admin'));

-- ---------------------------------------------------------------------------
-- Permission — Members screen (Flow 7): admin-only read/write, matching
-- "hidden entirely for non-admins, never just disabled" at the data layer.
-- ---------------------------------------------------------------------------

create policy permissions_select_admin_or_self
  on beacon.permissions for select
  to authenticated
  using (
    beacon.space_role_at_least(space_id, 'admin')
    or user_id = auth.uid()
  );

-- INSERT is split from UPDATE/DELETE to break a bootstrapping deadlock: the
-- very first (admin) permission row for a newly created Space can't require
-- an existing admin row, because none exists yet. The bootstrap clause below
-- allows exactly one case — the Space's own creator claiming their own row —
-- and only while the Space has no permission rows at all yet.
create policy permissions_insert_admin_or_bootstrap
  on beacon.permissions for insert
  to authenticated
  with check (
    beacon.space_role_at_least(space_id, 'admin')
    or (
      user_id = auth.uid()
      and exists (
        select 1 from beacon.spaces s
        where s.id = space_id and s.created_by_user_id = auth.uid()
      )
      and not exists (
        select 1 from beacon.permissions p where p.space_id = space_id
      )
    )
  );

create policy permissions_update_admin_only
  on beacon.permissions for update
  to authenticated
  using (beacon.space_role_at_least(space_id, 'admin'))
  with check (beacon.space_role_at_least(space_id, 'admin'));

create policy permissions_delete_admin_only
  on beacon.permissions for delete
  to authenticated
  using (beacon.space_role_at_least(space_id, 'admin'));

create policy pending_invites_admin_only
  on beacon.pending_invites for all
  to authenticated
  using (beacon.space_role_at_least(space_id, 'admin'))
  with check (beacon.space_role_at_least(space_id, 'admin'));

-- ---------------------------------------------------------------------------
-- Page — the core visibility rule (PRD.md §5.3): public reads require
-- visibility = 'publishable' AND is_published = true AND the Space itself is
-- publishable; internal reads require an explicit Space permission row.
-- ---------------------------------------------------------------------------

create policy pages_select_public_published
  on beacon.pages for select
  to anon
  using (
    visibility = 'publishable'
    and is_published = true
    and exists (
      select 1 from beacon.spaces s
      where s.id = pages.space_id and s.is_publishable = true
    )
  );

create policy pages_select_member_or_published
  on beacon.pages for select
  to authenticated
  using (
    beacon.user_space_role(space_id) is not null
    or (
      visibility = 'publishable'
      and is_published = true
      and exists (
        select 1 from beacon.spaces s
        where s.id = pages.space_id and s.is_publishable = true
      )
    )
  );

create policy pages_insert_editor
  on beacon.pages for insert
  to authenticated
  with check (beacon.space_role_at_least(space_id, 'editor'));

create policy pages_update_editor
  on beacon.pages for update
  to authenticated
  using (beacon.space_role_at_least(space_id, 'editor'))
  with check (beacon.space_role_at_least(space_id, 'editor'));

-- ---------------------------------------------------------------------------
-- ScreenshotBlock — mirrors the owning Page's internal visibility. Public
-- Viewers read screenshot content from pages.published_content_snapshot, not
-- this table, so no anon policy exists here (PRD.md §5.2 truth source note).
-- ---------------------------------------------------------------------------

create policy screenshot_blocks_select_member
  on beacon.screenshot_blocks for select
  to authenticated
  using (beacon.user_space_role(beacon.page_space_id(page_id)) is not null);

create policy screenshot_blocks_write_editor
  on beacon.screenshot_blocks for all
  to authenticated
  using (beacon.space_role_at_least(beacon.page_space_id(page_id), 'editor'))
  with check (beacon.space_role_at_least(beacon.page_space_id(page_id), 'editor'));

-- ---------------------------------------------------------------------------
-- Version — any Space member can read history; only editors/admins create
-- entries (autosave + restore are editor actions).
-- ---------------------------------------------------------------------------

create policy versions_select_member
  on beacon.versions for select
  to authenticated
  using (beacon.user_space_role(beacon.page_space_id(page_id)) is not null);

create policy versions_insert_editor
  on beacon.versions for insert
  to authenticated
  with check (beacon.space_role_at_least(beacon.page_space_id(page_id), 'editor'));

-- ---------------------------------------------------------------------------
-- Comment (Stage 3 wiring) — any Space member (viewer+) can read and post.
-- ---------------------------------------------------------------------------

create policy comments_select_member
  on beacon.comments for select
  to authenticated
  using (beacon.user_space_role(beacon.page_space_id(page_id)) is not null);

create policy comments_insert_member
  on beacon.comments for insert
  to authenticated
  with check (beacon.user_space_role(beacon.page_space_id(page_id)) is not null);

-- ---------------------------------------------------------------------------
-- Feedback (Stage 3 wiring) — anonymous single-click Yes/No on a published
-- page only; readable by editors/admins of the owning Space (helpfulness
-- rate shown to the author).
-- ---------------------------------------------------------------------------

create policy feedback_insert_public_on_published
  on beacon.feedback for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from beacon.pages p
      join beacon.spaces s on s.id = p.space_id
      where p.id = feedback.page_id
        and p.is_published = true
        and p.visibility = 'publishable'
        and s.is_publishable = true
    )
  );

create policy feedback_select_editor
  on beacon.feedback for select
  to authenticated
  using (beacon.space_role_at_least(beacon.page_space_id(page_id), 'editor'));

-- ---------------------------------------------------------------------------
-- New-user provisioning — Flow 1 signup has no Organization field, so a new
-- profile joins the Organization of its matching pending_invites row (Flow 7
-- step 4: "creates a pending invite row until that person accepts, via the
-- Sign Up flow"), or falls back to the earliest-created Organization to keep
-- parity with Stage 1's mock signIn/signUp (data-store.ts organizationsStore
-- seed). A real multi-org self-serve signup is out of v1 scope (PRD.md §12).
-- ---------------------------------------------------------------------------

create function beacon.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = beacon, extensions
as $$
declare
  invite beacon.pending_invites%rowtype;
  invite_found boolean;
  target_org_id uuid;
begin
  select pi.* into invite
  from beacon.pending_invites pi
  where lower(pi.email) = lower(new.email)
  order by pi.created_at asc
  limit 1;
  invite_found := found;

  if invite_found then
    select s.organization_id into target_org_id
    from beacon.spaces s where s.id = invite.space_id;
  else
    select o.id into target_org_id
    from beacon.organizations o
    order by o.created_at asc
    limit 1;
  end if;

  insert into beacon.profiles (id, email, name, organization_id, organization_role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    target_org_id,
    'member'
  );

  if invite_found then
    insert into beacon.permissions (space_id, user_id, role)
    values (invite.space_id, new.id, invite.role)
    on conflict (space_id, user_id) do nothing;

    delete from beacon.pending_invites where id = invite.id;
  end if;

  return new;
end;
$$;

-- Trigger name is prefixed because `auth.users` is shared across every app in
-- the Supabase project: an unprefixed `on_auth_user_created` would collide
-- with another app's trigger of the same name on the same table
-- (ERROR 42710: trigger "on_auth_user_created" for relation "users" already
-- exists). The `drop ... if exists` targets only the beacon-prefixed name, so
-- re-running this migration never touches the other app's trigger.
drop trigger if exists beacon_on_auth_user_created on auth.users;
create trigger beacon_on_auth_user_created
  after insert on auth.users
  for each row execute function beacon.handle_new_user();
