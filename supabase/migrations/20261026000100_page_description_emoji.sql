-- Editor heading meta (text-editor update):
--   * description — the optional one-line summary under the Page title
--     (placeholder "Page Description (Optional)").
--   * emoji       — the optional icon shown beside the Page title in the
--     sidebar tree and on the public page. NULL means "unset", and every
--     consumer renders nothing at all in that case (an unset emoji must
--     never show a placeholder glyph), which is why it is nullable rather
--     than defaulting to ''.
-- Both are covered by the existing table-level grants and the pages_update
-- RLS policy, so no policy changes are needed.
alter table beacon.pages
  add column if not exists description text not null default '',
  add column if not exists emoji text;
