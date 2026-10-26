-- Fix published Pages never becoming publicly readable.
--
-- publish_page() only flipped is_published + published_content_snapshot +
-- slug, but pages.visibility kept its creation default ('internal'). The
-- public RLS policies require BOTH visibility = 'publishable' AND
-- is_published = true, so every published Page stayed invisible to anon
-- visitors: the public Space landing listed nothing and /pages/{slug}
-- rendered "page not available".
--
-- Keep the two-field truth source from PRD.md §5.2/§9.2 (do not weaken RLS),
-- and make the publishing RPCs maintain visibility atomically:
--   publish/update -> visibility = 'publishable'
--   unpublish      -> visibility = 'internal'
--
-- The backfill repairs Pages already published before this fix. Safe to run
-- more than once. Paste into the Supabase SQL editor as-is (all names are
-- schema-qualified).

-- ---------------------------------------------------------------------------
-- Backfill: any Page currently published was meant to be publicly readable.
-- ---------------------------------------------------------------------------

update beacon.pages
set visibility = 'publishable'
where is_published = true
  and visibility = 'internal';

-- ---------------------------------------------------------------------------
-- publish_page: first publish assigns a slug (kept from
-- 20260929000000_fix_publish_slug_generation.sql) and now also marks the
-- Page publishable so the public RLS policy can see it.
-- ---------------------------------------------------------------------------

create or replace function beacon.publish_page(p_page_id uuid)
returns beacon.pages
language plpgsql
security invoker
set search_path = beacon, public, extensions
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
      visibility = 'publishable',
      published_at = v_published_at,
      published_content_snapshot = beacon.build_published_snapshot(p_page_id, v_published_at),
      slug = v_candidate
  where id = p_page_id
  returning * into v_page;

  if v_page.id is null then
    raise exception 'publish_page: page % not found or caller may not edit it', p_page_id
      using errcode = '42501';
  end if;

  return v_page;
end;
$$;

-- ---------------------------------------------------------------------------
-- update_published_page: also repairs visibility for Pages that were
-- published while the bug above existed. Its WHERE clause still requires
-- is_published = true, so it can never publish a draft.
-- ---------------------------------------------------------------------------

create or replace function beacon.update_published_page(p_page_id uuid)
returns beacon.pages
language plpgsql
security invoker
set search_path = beacon, extensions
as $$
declare
  v_published_at timestamptz := now();
  v_page beacon.pages;
begin
  update beacon.pages
  set visibility = 'publishable',
      published_at = v_published_at,
      published_content_snapshot = beacon.build_published_snapshot(p_page_id, v_published_at)
  where id = p_page_id and is_published = true
  returning * into v_page;

  if v_page.id is null then
    raise exception 'update_published_page: page % not published or caller may not edit it', p_page_id
      using errcode = '42501';
  end if;

  return v_page;
end;
$$;

-- ---------------------------------------------------------------------------
-- unpublish_page: return the Page to internal-only, matching "content is
-- internal-only by default; nothing reaches Viewers without an explicit
-- Publish". The stable slug is intentionally kept for a later republish.
-- ---------------------------------------------------------------------------

create or replace function beacon.unpublish_page(p_page_id uuid)
returns beacon.pages
language plpgsql
security invoker
set search_path = beacon, extensions
as $$
declare
  v_page beacon.pages;
begin
  update beacon.pages
  set is_published = false,
      visibility = 'internal'
  where id = p_page_id
  returning * into v_page;

  if v_page.id is null then
    raise exception 'unpublish_page: page % not found or caller may not edit it', p_page_id
      using errcode = '42501';
  end if;

  return v_page;
end;
$$;

grant execute on function beacon.publish_page(uuid) to authenticated;
grant execute on function beacon.update_published_page(uuid) to authenticated;
grant execute on function beacon.unpublish_page(uuid) to authenticated;
