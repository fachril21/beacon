-- Heals Spaces that were already created while the bootstrap RLS bug
-- (fixed in 20260808000000_fix_permissions_bootstrap_rls_recursion.sql) was
-- still live. That migration only fixes the policies for *future* Space
-- creations — any Space whose bootstrap Permission insert had already
-- failed by the time it was applied is stuck with zero Permission rows
-- forever: nobody, including the creator, can ever pass
-- permissions_insert_admin_or_bootstrap for it again, because that policy's
-- bootstrap clause only allows the very first Permission row on a Space,
-- and spaces_select_member_or_publishable only shows a non-publishable
-- Space to a User with a Permission row (or, transiently, its creator
-- before any Permission row exists — which is no longer true here, it's
-- just that the row that should have existed never landed).
--
-- Confirmed live via a read-only query against the production project
-- (2026-08-12): 7 of 9 Spaces had zero Permission rows, all created_by
-- their own creator, none publishable — i.e. genuinely inaccessible to
-- everyone, not an intentional public/ownerless state.
--
-- This is a one-time data backfill: for every Space with no Permission rows
-- at all, grant its creator the admin role they would have gotten had the
-- bootstrap insert succeeded the first time. Idempotent — safe to rerun,
-- and a no-op for every Space created after the RLS fix (which will already
-- have its creator's admin row).
insert into beacon.permissions (space_id, user_id, role)
select s.id, s.created_by_user_id, 'admin'
from beacon.spaces s
where not exists (
  select 1 from beacon.permissions p where p.space_id = s.id
);
