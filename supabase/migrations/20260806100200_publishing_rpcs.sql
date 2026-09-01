-- Atomic publish/update/unpublish (PRD.md Epic 13, US13.1) — is_published
-- and published_content_snapshot always change together in one statement,
-- so a Viewer can never observe is_published=true with a stale/missing
-- snapshot, or vice versa.
--
-- SECURITY INVOKER (the default, stated explicitly): these run as the
-- calling User, so the existing pages_update_editor RLS policy is the only
-- thing that decides who may call this successfully — no privilege
-- escalation, just atomicity. A non-editor's call affects zero rows, same
-- as a direct UPDATE would.

create function beacon.build_published_snapshot(p_page_id uuid, p_published_at timestamptz)
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

create function beacon.publish_page(p_page_id uuid)
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
  set is_published = true,
      published_at = v_published_at,
      published_content_snapshot = beacon.build_published_snapshot(p_page_id, v_published_at)
  where id = p_page_id
  returning * into v_page;

  return v_page;
end;
$$;

create function beacon.update_published_page(p_page_id uuid)
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

  return v_page;
end;
$$;

create function beacon.unpublish_page(p_page_id uuid)
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

  return v_page;
end;
$$;

grant execute on function beacon.publish_page(uuid) to authenticated;
grant execute on function beacon.update_published_page(uuid) to authenticated;
grant execute on function beacon.unpublish_page(uuid) to authenticated;
