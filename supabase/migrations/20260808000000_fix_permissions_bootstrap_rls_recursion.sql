-- Fixes two self-referential RLS visibility bugs that both block the "create
-- a new Space" flow (useCreateSpace in src/hooks/use-spaces.ts), reported
-- as: the Space row is inserted successfully and visible in Supabase, but
-- the UI shows "Tidak dapat membuat Space" anyway.
--
-- Both bugs share the same root cause shape: a policy (or a subquery inside
-- one) reads a table via a plain SELECT that is itself filtered by that
-- table's own RLS SELECT policy, and that policy in turn depends on a
-- Permission row that cannot exist yet during the very first moment a brand
-- new, non-publishable Space is created — a bootstrapping chicken-and-egg,
-- distinct from (and in addition to) the "which helper functions are
-- SECURITY DEFINER" pattern 20260806100100_rls_policies.sql already
-- documents for *other* recursion cases.
--
-- Bug 1 — spaces' own RETURNING/select-back:
--   useCreateSpace's first write is `insert into spaces (...) .select().single()`.
--   Postgres RLS applies a table's SELECT policies to an INSERT's RETURNING
--   clause, not just to plain SELECT statements. spaces_select_member_or_publishable
--   only allows `is_publishable = true or user_space_role(id) is not null` —
--   for a fresh, non-publishable Space, neither is true yet (no Permission
--   row exists until the *next* statement), so the newly-inserted row is
--   invisible to its own creator's RETURNING clause and PostgREST/postgrest-js
--   throws "no rows returned" right there, before useCreateSpace ever
--   reaches the Permission insert. Confirmed against a real local Postgres
--   (supabase start): `insert into spaces (...) returning id, name;` as the
--   authenticated creator raises "new row violates row-level security
--   policy for table spaces".
--
-- Bug 2 — permissions_insert_admin_or_bootstrap's own with-check subquery:
--   that policy ran a raw `exists (select 1 from beacon.spaces s where
--   s.id = space_id and s.created_by_user_id = auth.uid())` subquery, which
--   is itself filtered by the same spaces_select_member_or_publishable
--   policy — so even once Bug 1 is fixed and the Space becomes visible, this
--   second, independent occurrence of the identical bootstrap problem still
--   blocks the creator's own first (admin) Permission row.
--
-- Fix for both: wrap the "am I looking at my own thing during its creation
-- bootstrap window" check in a SECURITY DEFINER helper (the same pattern
-- already used for user_space_role/space_role_at_least), and extend the
-- affected SELECT/INSERT policies to allow exactly that narrow window —
-- the creator, before any Permission row exists yet for the Space — rather
-- than a permanent standing grant.

create or replace function beacon.is_space_creator(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = beacon, extensions
as $$
  select exists (
    select 1 from beacon.spaces s
    where s.id = p_space_id and s.created_by_user_id = auth.uid()
  );
$$;

-- Bug 1 fix: let the creator see their own Space during the bootstrap
-- window (no Permission row on it yet), in addition to the existing
-- publishable/member visibility.
drop policy if exists spaces_select_member_or_publishable on beacon.spaces;

create policy spaces_select_member_or_publishable
  on beacon.spaces for select
  to authenticated
  using (
    is_publishable = true
    or beacon.user_space_role(id) is not null
    or (
      created_by_user_id = auth.uid()
      and not exists (select 1 from beacon.permissions p where p.space_id = id)
    )
  );

-- Bug 2 fix: use the SECURITY DEFINER helper instead of a raw subquery
-- against spaces, so it isn't re-filtered by spaces' own RLS.
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
        select 1 from beacon.permissions p where p.space_id = space_id
      )
    )
  );
