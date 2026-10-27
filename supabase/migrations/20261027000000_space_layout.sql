-- Space Management redesign:
--   * description — Space-level subtitle shown on the public Space landing
--     page and under the Space title in the workspace.
--   * icon        — optional emoji shown beside the Space name. NULL means
--     "unset" and every consumer renders no glyph at all.
--   * layout      — the admin-authored Space landing layout (sections,
--     column counts, and ordered Page references) as JSONB. NULL means the
--     Space has never been arranged; readers fall back to the automatic
--     page tree, so existing Spaces keep working untouched.
--   * show_page_list — Navigation setting for the public sidebar. Defaults
--     to true to preserve the current behaviour.
--
-- These columns are covered by the existing table-level grants and the
-- spaces_update_admin_only RLS policy, so no policy changes are needed.
alter table beacon.spaces
  add column if not exists description text not null default '',
  add column if not exists icon text,
  add column if not exists layout jsonb,
  add column if not exists show_page_list boolean not null default true;
