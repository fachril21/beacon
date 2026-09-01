-- Per-Space public site (documentation-publishing feature): the public site
-- is now organised per Space — an Organization's public home is a directory
-- of its publishable Spaces, and each Space has its own page at
-- /public/{orgSlug}/spaces/{spaceSlug}. That URL segment needs a stable,
-- URL-safe identity per Space, unique within its Organization (two
-- Organizations may each have a "panduan" Space).
--
-- App-level format/reserved-word validation lives in src/lib/slug.ts; this
-- migration only enforces the DB-level invariants (per-Organization
-- uniqueness) and auto-backfills any existing Spaces so it ships without a
-- manual data-fix step. Mirrors 20260813010000_organization_page_slugs.sql.

-- ---------------------------------------------------------------------------
-- spaces.slug — derived from the Space name by a BEFORE INSERT trigger.
-- Spaces are created in-app (New Space modal) without a slug field, so the
-- trigger is the only assignment path; it is deliberately NOT regenerated on
-- rename (matching organizations.slug and pages.slug — a public URL, once
-- handed out, stays stable).
-- ---------------------------------------------------------------------------

alter table public.spaces add column slug text;

create function public.spaces_set_slug()
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
  while exists (
    select 1 from public.spaces
    where organization_id = new.organization_id and slug = candidate and id <> new.id
  ) loop
    n := n + 1;
    candidate := base_slug || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

create trigger spaces_set_slug_trigger
before insert on public.spaces
for each row execute function public.spaces_set_slug();

-- Backfill existing Spaces — the trigger only fires on INSERT.
do $$
declare
  r record;
  base_slug text;
  candidate text;
  n int;
begin
  for r in select id, name, organization_id from public.spaces where slug is null order by created_at loop
    base_slug := public.slugify(r.name);
    candidate := base_slug;
    n := 1;
    while exists (
      select 1 from public.spaces
      where organization_id = r.organization_id and slug = candidate and id <> r.id
    ) loop
      n := n + 1;
      candidate := base_slug || '-' || n;
    end loop;
    update public.spaces set slug = candidate where id = r.id;
  end loop;
end $$;

alter table public.spaces alter column slug set not null;

create unique index spaces_organization_id_slug_unique
  on public.spaces (organization_id, slug);

comment on column public.spaces.slug is
  'Public URL slug (/public/{orgSlug}/spaces/{slug}) — assigned from the name by spaces_set_slug() on INSERT, unique per Organization, stable for the life of the Space. Publicly readable via the existing spaces_select_public_publishable policy.';
