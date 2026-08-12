# TDD Evidence Report — "Create Space" fails with an error despite the row landing in Supabase

## Source plan

No `*.plan.md` was provided. The user reported: after clicking "Buat" (Create) in the new-Space dialog, the UI shows a creation-failure toast, but the Space row is confirmed present in Supabase's `spaces` table.

## Root cause

This is a database (RLS) bug, not an application bug — `useCreateSpace` (`src/hooks/use-spaces.ts`) was already correct. Two independent, same-shaped RLS bootstrap bugs in `supabase/migrations/20260806100100_rls_policies.sql` both block the flow:

1. **`spaces` insert's own `RETURNING`/select-back.** `useCreateSpace`'s first write is `insert into spaces (...).select().single()`. Postgres RLS applies a table's SELECT policies to an INSERT's `RETURNING` clause, not just to plain `SELECT`s. The `spaces_select_member_or_publishable` policy only allowed `is_publishable = true or user_space_role(id) is not null` — for a brand-new, non-publishable Space, neither is true yet (no Permission row exists until the *next* statement), so the row is invisible to its own creator's `RETURNING`, and PostgREST throws "no rows returned" immediately — before `useCreateSpace` ever reaches the Permission insert.
2. **`permissions_insert_admin_or_bootstrap`'s own `with check` subquery.** That policy ran a raw `exists (select 1 from public.spaces s where s.id = space_id and s.created_by_user_id = auth.uid())` subquery — itself filtered by the *same* `spaces_select_member_or_publishable` policy, so even once bug 1 is fixed, this second, independent occurrence of the identical bootstrap problem still blocks the creator's own first (admin) Permission row.

Both are the same class of bug the migration's own comment already named for its SECURITY DEFINER helper functions ("policies that call them don't recursively re-trigger RLS on profiles/permissions") — but that pattern wasn't applied to these two spots.

## User journeys

1. As a new User creating their first Space, I want the Space to actually appear as created (no error toast, redirected into it) the moment I click "Buat", so I'm not confused about whether it worked.
2. As that same User, I want to immediately have admin rights on the Space I just created, so I can start adding Pages without a separate step.
3. As an unrelated User, I must **not** gain any visibility into, or admin rights over, a Space I did not create and have no Permission row on — the bootstrap fix must not be a privilege-escalation path.

## Task report

| Task | Summary | Validation command | Result |
|---|---|---|---|
| Investigation | Read `useCreateSpace`, the RLS policy migration, and the schema; formed the hypothesis that the bootstrap Permission insert's `with check` subquery on `spaces` was itself RLS-filtered | Code review | Hypothesis formed |
| RED (real Postgres, not mocked) | Started a local Supabase stack (`supabase start`, Docker), applied all existing migrations, then ran the exact `insert ... returning` `useCreateSpace` performs, as the authenticated creator (via `request.jwt.claims` + `set local role authenticated`) — the same mechanism PostgREST uses per-request | `docker exec -i supabase_db_beacon psql -U postgres < <repro>.sql` | FAIL — `ERROR: new row violates row-level security policy for table "spaces"` on the **first** insert, and separately `ERROR: ... for table "permissions"` on the second — reproducing the exact reported symptom against a real database, not a guess |
| GREEN | Added `supabase/migrations/20260808000000_fix_permissions_bootstrap_rls_recursion.sql`: a `is_space_creator()` SECURITY DEFINER helper, an extended `spaces_select_member_or_publishable` policy (adds a narrow "creator, during the bootstrap window only" clause), and `permissions_insert_admin_or_bootstrap` rewritten to use the helper instead of a raw RLS-filtered subquery | `supabase db reset` (reapplies all migrations) then rerun the same repro script | PASS — both statements return rows: `Test Space A` and `admin` |
| Regression (negative/security) | Reran as a second, unrelated authenticated user against the first user's Space | same session, `supabase/tests/space-creation-rls.sql` | PASS — stranger sees 0 rows for the Space; stranger's self-insert into `permissions` is rejected with the same RLS violation |
| Regression (application code) | Confirmed the existing hook unit tests (unaffected — no TS code changed) still pass | `npx vitest run src/hooks/use-spaces.test.ts` | PASS 3/3 |
| Regression (full suite) | Full project test suite, untouched by this DB-only fix | `npx vitest run` | PASS 153/153 |
| Typecheck | `npx tsc --noEmit --pretty false` | — | `TypeScript: No errors found` |

## What is guaranteed by the passing tests

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | A brand-new, non-publishable Space's creator can see it via `INSERT ... RETURNING` immediately, with zero Permission rows existing yet | `supabase/tests/space-creation-rls.sql` (positive block, step 1) | integration (real Postgres + RLS) | PASS | `docker exec -i supabase_db_beacon psql -U postgres < supabase/tests/space-creation-rls.sql` |
| 2 | That same creator can insert their own first (bootstrap) `admin` Permission row on that Space | same file, step 2 | integration | PASS | same |
| 3 | An unrelated authenticated User cannot see another creator's non-publishable Space | same file, negative block | integration | PASS | same |
| 4 | An unrelated authenticated User cannot self-insert an `admin` Permission row on a Space they did not create | same file, negative block | integration | PASS | same |
| 5 | No existing hook or component behavior regressed (this fix touches zero TypeScript) | `npx vitest run` | full suite | PASS | 153/153 |

## Coverage and known gaps

This fix is entirely in `supabase/migrations/`; there is no TypeScript statement/branch coverage to report — `npx vitest run` (153/153) and `npx tsc --noEmit` confirm zero application-code regression, which is the correct coverage claim for a database-only change.

**Known, intentional gaps / follow-ups:**

- The project has no existing pgTAP or CI-wired SQL test runner. `supabase/tests/space-creation-rls.sql` is a plain, rerunnable `psql` script (not wired into any CI job) — it is real regression evidence, but rerunning it today is a manual step (`supabase start && supabase db reset`, then the `docker exec` invocation documented at the top of the file). Wiring a `supabase test db` / pgTAP job into CI was judged out of scope for this bug fix.
- A fresh local `supabase start` does **not** auto-grant `anon`/`authenticated`/`service_role` table privileges the way an existing hosted Supabase project already has from its original provisioning (this is unrelated to the RLS bug itself — it's a local-CLI-only default-privilege gap). The test script documents the one-time `GRANT` workaround needed to exercise these policies locally; this is not something to "fix" in a migration, since the remote project already has the correct grants (confirmed by the fact that the Space row itself was successfully inserted there).
- This migration must still be **applied to the live remote Supabase project** (`supabase db push`, or run via the Supabase SQL editor) — writing the migration file into this repo does not, by itself, change the live database. I did not run this against the remote project; it needs the project owner's explicit go-ahead since altering RLS policies on a live database is a shared-infrastructure change.

## Merge evidence

RED → GREEN, in order, both validated against a real local Postgres (not mocked):

1. **RED**: reproduced the exact `useCreateSpace` statement sequence as the authenticated creator against the *unmodified* migrations — both the `spaces` `RETURNING` and the `permissions` bootstrap insert failed with genuine RLS violations, matching the reported symptom (`spaces` row exists, client sees an error).
2. **GREEN**: added `20260808000000_fix_permissions_bootstrap_rls_recursion.sql`; `supabase db reset` reapplied it; the identical statement sequence now succeeds, and the added negative-case checks confirm no privilege escalation for unrelated users.

No checkpoint commits were created during this workflow — commits are made only when explicitly requested, per this repository's working agreement.
