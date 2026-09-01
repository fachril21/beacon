-- Delete policies for Space and Page. Neither table had a FOR DELETE policy
-- before this migration, so RLS's default-deny (20260806100100_rls_policies.sql
-- header comment: "no default access — access exists only through the
-- policies below") silently filtered any client .delete() call to zero
-- affected rows. Role thresholds mirror each table's existing UPDATE policy:
-- Space delete is admin-only (spaces_update_admin_only), Page delete is
-- editor-or-above (pages_update_editor). Postgres's own FK "on delete
-- cascade" (20260806100000_initial_schema.sql) then removes everything
-- underneath — child pages, screenshot_blocks, versions, comments, feedback,
-- and for a Space, its permissions/pending_invites too.

create policy spaces_delete_admin_only
  on beacon.spaces for delete
  to authenticated
  using (beacon.space_role_at_least(id, 'admin'));

create policy pages_delete_editor
  on beacon.pages for delete
  to authenticated
  using (beacon.space_role_at_least(space_id, 'editor'));
