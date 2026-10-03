-- Fix "failed to publish": harden slug generation inside publish_page.
--
-- Root cause candidates addressed here:
--   1. beacon.slugify() calls unaccent(), which 20260813010000 installs with
--      `create extension if not exists unaccent` and no target schema. On
--      Supabase that lands in `public` (or `extensions`), but publish_page
--      runs with search_path = beacon, extensions — so on a page's FIRST
--      publish (the only time a slug is generated) the call fails with
--      "function unaccent(text) does not exist". slugify now pins its own
--      search_path covering every place unaccent may live.
--   2. publish_page / update_published_page / unpublish_page returned an
--      all-null row (not an error) when RLS filtered the UPDATE to zero rows,
--      so a non-editor saw a confusing client-side crash. They now raise
--      42501 explicitly; the app maps that to a clear message.
--
-- Safe to run more than once. Run AFTER 20260817000100_space_slugs.sql.
-- Paste into the Supabase SQL editor as-is (all names are schema-qualified).

create extension if not exists unaccent with schema extensions;

create or replace function beacon.slugify(p_text text)
returns text
language sql
immutable
set search_path = pg_catalog, public, extensions
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(unaccent(p_text)), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'untitled'
  );
$$;

-- build_published_snapshot reads only beacon tables; make it independent of
-- the caller's search_path too.
create or replace function beacon.build_published_snapshot(p_page_id uuid, p_published_at timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = beacon, extensions
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
  set published_at = v_published_at,
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
  set is_published = false
  where id = p_page_id
  returning * into v_page;

  if v_page.id is null then
    raise exception 'unpublish_page: page % not found or caller may not edit it', p_page_id
      using errcode = '42501';
  end if;

  return v_page;
end;
$$;

grant execute on function beacon.slugify(text) to authenticated, anon, service_role;
grant execute on function beacon.publish_page(uuid) to authenticated;
grant execute on function beacon.update_published_page(uuid) to authenticated;
grant execute on function beacon.unpublish_page(uuid) to authenticated;
