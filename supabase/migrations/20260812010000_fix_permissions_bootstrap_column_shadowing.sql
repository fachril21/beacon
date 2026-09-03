-- Fixes a column-shadowing bug in permissions_insert_admin_or_bootstrap's
-- bootstrap clause, introduced by 20260806100100_rls_policies.sql and left
-- unnoticed by 20260808000000_fix_permissions_bootstrap_rls_recursion.sql.
--
-- The clause was:
--   not exists (
--     select 1 from beacon.permissions p where p.space_id = space_id
--   )
-- The bare `space_id` on the right was meant to correlate to the NEW row
-- being inserted (the policy's own table, `permissions`). But the subquery
-- is *also* against `permissions` (aliased `p`), which has a column
-- literally named `space_id` — standard SQL scoping resolves an unqualified
-- column against the innermost enclosing scope first, so `space_id` bound
-- to `p.space_id`, not the outer new row. The clause was really
-- `p.space_id = p.space_id`: a tautology, true for any existing Permission
-- row anywhere, on any Space.
--
-- Practical effect: `not exists(...)` was false as soon as the `permissions`
-- table had *any* row at all — not just a row for *this* Space. Bootstrap
-- only ever worked for a User's very first-ever Space creation across the
-- whole project; every subsequent Space by anyone, once at least one
-- Permission row existed anywhere, hit "new row violates row-level security
-- policy for table permissions" on the bootstrap insert. Reproduced locally
-- in supabase/tests/space-creation-second-bootstrap.sql: first Space
-- succeeds, second Space (same creator) fails on the Permission insert with
-- that exact message, even though the second Space itself has zero
-- Permission rows.
--
-- Fix: qualify the outer/new-row reference with the table's own name
-- (`permissions.space_id`), which is unambiguous since the subquery's alias
-- is `p`, not `permissions` — the standard technique for breaking this kind
-- of RLS self-correlation ambiguity.
drop policy if exists permissions_insert_admin_or_bootstrap on beacon.permissions;

create policy permissions_insert_admin_or_bootstrap
  on beacon.permissions for insert
  to authenticated
  with check (
    beacon.space_role_at_least(space_id, 'admin')
    or (
      user_id = auth.uid()
      and beacon.is_space_creator(space_id)
      and not exists (
        select 1 from beacon.permissions p where p.space_id = permissions.space_id
      )
    )
  );

-- Same shadowing shape existed in spaces_select_member_or_publishable's
-- bootstrap clause (`not exists (select 1 from beacon.permissions p where
-- p.space_id = id)` — `permissions` also has its own `id` column, so bare
-- `id` bound to `p.id`, not `spaces.id`). There it failed *open* rather
-- than closed: `p.space_id = p.id` is never true for real data (different
-- UUID domains), so `not exists(...)` was always true, making the
-- "no Permission rows yet" bootstrap-visibility window permanently open for
-- the creator instead of closing once a Permission row exists — a latent
-- correctness/security gap, not the bug the User hit, but the same root
-- cause and worth closing at the same time.
drop policy if exists spaces_select_member_or_publishable on beacon.spaces;

create policy spaces_select_member_or_publishable
  on beacon.spaces for select
  to authenticated
  using (
    is_publishable = true
    or beacon.user_space_role(id) is not null
    or (
      created_by_user_id = auth.uid()
      and not exists (select 1 from beacon.permissions p where p.space_id = spaces.id)
    )
  );
