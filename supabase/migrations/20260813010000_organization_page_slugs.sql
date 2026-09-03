-- Platform-domain publishing (documentation-publishing feature, Phase 1):
-- every Organization needs a stable, URL-safe identity that works without a
-- custom domain (/public/{orgSlug}), and every published Page needs one too
-- (/public/{orgSlug}/pages/{pageSlug}) — until now the public Page URL was
-- the raw UUID. App-level format/reserved-word validation lives in
-- src/lib/slug.ts; this migration only enforces the DB-level invariants
-- (uniqueness) and auto-backfills the two existing seed Organizations plus
-- any already-published Pages so this ships without a manual data-fix step.

-- ---------------------------------------------------------------------------
-- organizations.slug — Organizations are admin-created (no self-serve
-- create-org flow exists in this app, per PRD.md §12), so a BEFORE INSERT
-- trigger deriving a default slug from name is sufficient; there's no
-- in-app "create Organization" form to wire slug input into.
-- ---------------------------------------------------------------------------

alter table beacon.organizations add column slug text;

create extension if not exists unaccent;

create function beacon.slugify(p_text text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(unaccent(p_text)), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'untitled'
  );
$$;

comment on function beacon.slugify(text) is
  'Mirrors src/lib/slug.ts slugify() — kept in sync by hand, not generated, since Postgres and JS have no shared source. Requires the unaccent extension for diacritic stripping.';

create function beacon.organizations_set_slug()
returns trigger
language plpgsql
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

create trigger organizations_set_slug_trigger
before insert on beacon.organizations
for each row execute function beacon.organizations_set_slug();

-- Backfill the two existing seed Organizations (Dibimbing, Cakrawala
-- University) — trigger only fires on INSERT, not on rows that already exist.
do $$
declare
  r record;
  base_slug text;
  candidate text;
  n int;
begin
  for r in select id, name from beacon.organizations where slug is null order by created_at loop
    base_slug := beacon.slugify(r.name);
    candidate := base_slug;
    n := 1;
    while exists (select 1 from beacon.organizations where slug = candidate and id <> r.id) loop
      n := n + 1;
      candidate := base_slug || '-' || n;
    end loop;
    update beacon.organizations set slug = candidate where id = r.id;
  end loop;
end $$;

alter table beacon.organizations alter column slug set not null;
alter table beacon.organizations add constraint organizations_slug_unique unique (slug);

comment on column beacon.organizations.slug is
  'Platform-domain identity (/public/{slug}) — always available, independent of custom-domain verification. Publicly readable via the existing organizations_select_public policy.';

-- ---------------------------------------------------------------------------
-- pages.organization_id — denormalized from spaces.organization_id so
-- (organization_id, slug) can be a single-table unique constraint (a Page's
-- own row has no direct Organization reference otherwise). Kept in sync by
-- a BEFORE INSERT trigger; Pages are never moved to a different Space's
-- Organization in this app (no such feature exists), so no UPDATE trigger
-- is needed to keep it consistent after creation.
-- ---------------------------------------------------------------------------

alter table beacon.pages add column organization_id uuid references beacon.organizations (id);

create function beacon.pages_set_organization_id()
returns trigger
language plpgsql
as $$
begin
  select s.organization_id into new.organization_id
  from beacon.spaces s
  where s.id = new.space_id;
  return new;
end;
$$;

create trigger pages_set_organization_id_trigger
before insert on beacon.pages
for each row execute function beacon.pages_set_organization_id();

update beacon.pages p
set organization_id = s.organization_id
from beacon.spaces s
where s.id = p.space_id and p.organization_id is null;

alter table beacon.pages alter column organization_id set not null;

-- ---------------------------------------------------------------------------
-- pages.slug — auto-generated at publish time (not at creation), since only
-- published Pages need a public URL; draft/internal Pages never render one.
-- publish_page (20260806100200_publishing_rpcs.sql) is updated below to
-- assign it, collision-safe, the first time a Page is published.
-- ---------------------------------------------------------------------------

alter table beacon.pages add column slug text;

do $$
declare
  r record;
  base_slug text;
  candidate text;
  n int;
begin
  for r in select id, title, organization_id from beacon.pages where is_published = true and slug is null order by created_at loop
    base_slug := beacon.slugify(coalesce(nullif(trim(r.title), ''), 'untitled'));
    candidate := base_slug;
    n := 1;
    while exists (
      select 1 from beacon.pages
      where organization_id = r.organization_id and slug = candidate and id <> r.id
    ) loop
      n := n + 1;
      candidate := base_slug || '-' || n;
    end loop;
    update beacon.pages set slug = candidate where id = r.id;
  end loop;
end $$;

create unique index pages_organization_id_slug_unique
  on beacon.pages (organization_id, slug)
  where slug is not null;

comment on column beacon.pages.slug is
  'Public URL slug (/public/{orgSlug}/pages/{slug}) — null until first published; assigned by publish_page(), unique per Organization. Never reused across Organizations (see pages_organization_id_slug_unique).';

-- ---------------------------------------------------------------------------
-- publish_page: assign a slug the first time a Page is published (idempotent
-- on republish/update — a Page keeps its first slug for the life of the
-- Page, matching "never a fallback to real content on a different URL").
-- ---------------------------------------------------------------------------

create or replace function beacon.publish_page(p_page_id uuid)
returns beacon.pages
language plpgsql
security invoker
set search_path = beacon, extensions
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
