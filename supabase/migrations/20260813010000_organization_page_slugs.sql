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

alter table public.organizations add column slug text;

create extension if not exists unaccent;

create function public.slugify(p_text text)
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

comment on function public.slugify(text) is
  'Mirrors src/lib/slug.ts slugify() — kept in sync by hand, not generated, since Postgres and JS have no shared source. Requires the unaccent extension for diacritic stripping.';

create function public.organizations_set_slug()
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

  base_slug := public.slugify(new.name);
  candidate := base_slug;
  while exists (select 1 from public.organizations where slug = candidate and id <> new.id) loop
    n := n + 1;
    candidate := base_slug || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

create trigger organizations_set_slug_trigger
before insert on public.organizations
for each row execute function public.organizations_set_slug();

-- Backfill the two existing seed Organizations (Dibimbing, Cakrawala
-- University) — trigger only fires on INSERT, not on rows that already exist.
do $$
declare
  r record;
  base_slug text;
  candidate text;
  n int;
begin
  for r in select id, name from public.organizations where slug is null order by created_at loop
    base_slug := public.slugify(r.name);
    candidate := base_slug;
    n := 1;
    while exists (select 1 from public.organizations where slug = candidate and id <> r.id) loop
      n := n + 1;
      candidate := base_slug || '-' || n;
    end loop;
    update public.organizations set slug = candidate where id = r.id;
  end loop;
end $$;

alter table public.organizations alter column slug set not null;
alter table public.organizations add constraint organizations_slug_unique unique (slug);

comment on column public.organizations.slug is
  'Platform-domain identity (/public/{slug}) — always available, independent of custom-domain verification. Publicly readable via the existing organizations_select_public policy.';

-- ---------------------------------------------------------------------------
-- pages.organization_id — denormalized from spaces.organization_id so
-- (organization_id, slug) can be a single-table unique constraint (a Page's
-- own row has no direct Organization reference otherwise). Kept in sync by
-- a BEFORE INSERT trigger; Pages are never moved to a different Space's
-- Organization in this app (no such feature exists), so no UPDATE trigger
-- is needed to keep it consistent after creation.
-- ---------------------------------------------------------------------------

alter table public.pages add column organization_id uuid references public.organizations (id);

create function public.pages_set_organization_id()
returns trigger
language plpgsql
as $$
begin
  select s.organization_id into new.organization_id
  from public.spaces s
  where s.id = new.space_id;
  return new;
end;
$$;

create trigger pages_set_organization_id_trigger
before insert on public.pages
for each row execute function public.pages_set_organization_id();

update public.pages p
set organization_id = s.organization_id
from public.spaces s
where s.id = p.space_id and p.organization_id is null;

alter table public.pages alter column organization_id set not null;

-- ---------------------------------------------------------------------------
-- pages.slug — auto-generated at publish time (not at creation), since only
-- published Pages need a public URL; draft/internal Pages never render one.
-- publish_page (20260806100200_publishing_rpcs.sql) is updated below to
-- assign it, collision-safe, the first time a Page is published.
-- ---------------------------------------------------------------------------

alter table public.pages add column slug text;

do $$
declare
  r record;
  base_slug text;
  candidate text;
  n int;
begin
  for r in select id, title, organization_id from public.pages where is_published = true and slug is null order by created_at loop
    base_slug := public.slugify(coalesce(nullif(trim(r.title), ''), 'untitled'));
    candidate := base_slug;
    n := 1;
    while exists (
      select 1 from public.pages
      where organization_id = r.organization_id and slug = candidate and id <> r.id
    ) loop
      n := n + 1;
      candidate := base_slug || '-' || n;
    end loop;
    update public.pages set slug = candidate where id = r.id;
  end loop;
end $$;

create unique index pages_organization_id_slug_unique
  on public.pages (organization_id, slug)
  where slug is not null;

comment on column public.pages.slug is
  'Public URL slug (/public/{orgSlug}/pages/{slug}) — null until first published; assigned by publish_page(), unique per Organization. Never reused across Organizations (see pages_organization_id_slug_unique).';

-- ---------------------------------------------------------------------------
-- publish_page: assign a slug the first time a Page is published (idempotent
-- on republish/update — a Page keeps its first slug for the life of the
-- Page, matching "never a fallback to real content on a different URL").
-- ---------------------------------------------------------------------------

create or replace function public.publish_page(p_page_id uuid)
returns public.pages
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_published_at timestamptz := now();
  v_page public.pages;
  v_base_slug text;
  v_candidate text;
  v_n int := 1;
  v_organization_id uuid;
  v_existing_slug text;
begin
  select organization_id, slug into v_organization_id, v_existing_slug
  from public.pages where id = p_page_id;

  if v_existing_slug is null then
    select title into v_base_slug from public.pages where id = p_page_id;
    v_base_slug := public.slugify(coalesce(nullif(trim(v_base_slug), ''), 'untitled'));
    v_candidate := v_base_slug;
    while exists (
      select 1 from public.pages
      where organization_id = v_organization_id and slug = v_candidate and id <> p_page_id
    ) loop
      v_n := v_n + 1;
      v_candidate := v_base_slug || '-' || v_n;
    end loop;
  else
    v_candidate := v_existing_slug;
  end if;

  update public.pages
  set is_published = true,
      published_at = v_published_at,
      published_content_snapshot = public.build_published_snapshot(p_page_id, v_published_at),
      slug = v_candidate
  where id = p_page_id
  returning * into v_page;

  return v_page;
end;
$$;
