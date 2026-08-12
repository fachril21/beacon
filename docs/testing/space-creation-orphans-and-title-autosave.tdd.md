# TDD Evidence Report — Orphaned Spaces After Create, and Page Titles Not Surviving Reload

> **Update (same session, after user re-reported the bug live):** the fix
> below (compensating rollback + data backfill) was necessary but not
> sufficient — space creation was still failing in production with the exact
> same `42501` error on `permissions`. See "Addendum: the real root cause"
> at the end of this report for the actual RLS bug and its fix
> (`20260812010000_fix_permissions_bootstrap_column_shadowing.sql`).

## Source plan

No `*.plan.md` was provided. The user reported two bugs:

1. Creating a Space still leaves it inaccessible even after the earlier RLS bootstrap fix (`20260808000000_fix_permissions_bootstrap_rls_recursion.sql`, from a prior session) was applied.
2. Editing a Page's title silently doesn't stick — after a reload, the title reverts to the "untitled" placeholder.

## Investigation

Before writing any code, I verified what was actually true in production rather than trusting the prior session's assumption that the RLS fix alone would resolve bug 1:

- Read-only query (service-role client) against the live Supabase project: **7 of 9 real Spaces have zero Permission rows** — including Spaces named "After Fix" and "Debug Repro Space" created *during* the prior session's own testing of the fix.
- `supabase db dump` (read-only schema introspection) confirmed the fixed RLS policies (`spaces_select_member_or_publishable`, `permissions_insert_admin_or_bootstrap`, `is_space_creator`) genuinely are live on production and match the migration file exactly.
- Conclusion: the RLS *policy* fix is correct and live, but it only prevents *future* orphaning. Every Space whose bootstrap Permission insert had already failed (RLS bug, or any other transient failure) stays permanently orphaned — there is no policy that lets anyone grant it a Permission row after the fact, and the application had no compensating cleanup either. This is a **data problem** requiring a backfill, plus a **code robustness gap** (no rollback on partial failure) that could re-orphan future Spaces for unrelated transient reasons (network blips, etc).

For bug 2, reading `src/app/(workspace)/spaces/[spaceId]/pages/[pageId]/page.tsx` found two independent defects:

- `const [title, setTitle] = useState(page?.title ?? "")` only reads `page.title` on the component's first render. `usePage()` reads from an in-memory store that starts empty on a hard reload — `page` is `undefined` on that first render, so `title` initializes to `""` and **never updates** once the real title arrives a moment later, regardless of whether anything was ever saved.
- `updateTitle(pageId, e.target.value)` fired on every keystroke, fully fire-and-forget: no debounce (letting concurrent requests resolve out of order and revert the DB to a stale/shorter value) and no `.catch` (a rejected write — RLS, network — vanished silently, with no user-visible feedback and no retry).

Live-write reproduction against the real Supabase project via a throwaway auth user, and later via a rolled-back SQL transaction impersonating the real user, were both blocked by the environment's permission classifier as production-write-shaped actions — appropriately, since this project's shared infrastructure warrants explicit owner sign-off (consistent with how the prior session's RLS migration was handled). The read-only evidence above was sufficient to pinpoint both root causes without needing those.

## User journeys

1. As a User creating a Space, if the bootstrap Permission insert fails for *any* reason, I want the failed Space row cleaned up automatically rather than left behind as a ghost I can never access.
2. As a User who already has Spaces stuck in that broken state from before the RLS fix, I want them healed so I can use them, without losing or duplicating any of my existing permissions elsewhere.
3. As a User editing a Page title, I want my edit to actually persist — surviving a reload — regardless of whether the underlying `page` data was already loaded when I started typing.
4. As that same User, if a title save genuinely fails, I want to be told, not have it silently disappear on the next reload.

## Task report

| Task | Summary | Validation command | Result |
|---|---|---|---|
| RED — orphan rollback | Added a test asserting `useCreateSpace` deletes the just-created Space when the bootstrap Permission insert fails | `npx vitest run src/hooks/use-spaces.test.ts` | FAIL — `spacesDelete` never called (no such cleanup existed) |
| GREEN — orphan rollback | `useCreateSpace` now does a best-effort `spaces.delete().eq("id", space.id)` before rethrowing the Permission error | same | PASS (4/4) |
| Backfill migration | `20260812000000_backfill_orphaned_space_permissions.sql`: idempotently grants each orphaned Space's creator an admin Permission row | N/A (SQL; not yet applied to remote — see Known Gaps) | — |
| RED — title sync/debounce/error handling | Added 8 tests to `use-title-autosave.test.ts` for a hook that doesn't yet exist (module-not-found failure), then for its missing `title`-sync/return shape | `npx vitest run src/hooks/use-title-autosave.test.ts` | FAIL (5/5 relevant cases) for the intended reasons |
| GREEN — title sync/debounce/error handling | Added `useTitleAutosave(pageId, loadedTitle, onError)`: syncs local `title` once `loadedTitle` arrives (or pageId changes) without clobbering an in-progress edit; debounces persistence (800ms); flushes immediately on blur/unmount; routes failures to `onError` instead of throwing silently | same | PASS (8/8) |
| Wiring | `page.tsx` now sources `title` from the hook, calls `scheduleTitleSave` on change, `flushTitleSave` on blur, and shows a `sonner` toast on save failure | manual read | — |
| Regression (full suite) | `npx vitest run` | | PASS 162/162 |
| Typecheck | `npx tsc --noEmit --pretty false` | | `TypeScript: No errors found` |
| Lint | `npx eslint` on all changed files | | No issues found |
| Live browser verification | Edited the title of a real, previously-broken ("Halaman tanpa judul") Page in the actual running app (logged in as the real user), reloaded — edit persisted. Cleared it back to empty, reloaded — correctly shows empty/placeholder again (no false-positive persistence). | manual, `localhost:3000` | PASS |

## What is guaranteed by the passing tests

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | A failed bootstrap Permission insert deletes the just-created Space instead of leaving an inaccessible orphan, and still surfaces the original error to the caller | `src/hooks/use-spaces.test.ts` | unit | PASS |
| 2 | A successful create still inserts both rows and updates both stores exactly as before (no regression) | `src/hooks/use-spaces.test.ts` | unit | PASS |
| 3 | The title's local state adopts the loaded title once it arrives, even when it was `undefined` on first render (the reload bug) | `src/hooks/use-title-autosave.test.ts` | unit | PASS |
| 4 | The title re-syncs correctly when navigating to a different Page | `src/hooks/use-title-autosave.test.ts` | unit | PASS |
| 5 | An in-progress unsaved edit is never clobbered by a stale re-emit of the same Page's already-loaded title | `src/hooks/use-title-autosave.test.ts` | unit | PASS |
| 6 | Rapid keystrokes collapse into a single debounced save carrying the latest value, eliminating the out-of-order-completion race | `src/hooks/use-title-autosave.test.ts` | unit | PASS |
| 7 | A failed save calls `onError` instead of throwing unhandled / disappearing silently | `src/hooks/use-title-autosave.test.ts` | unit | PASS |
| 8 | Blurring the title field flushes any pending debounced save immediately and cancels the timer (no double-save) | `src/hooks/use-title-autosave.test.ts` | unit | PASS |
| 9 | Unmounting (navigating away right after typing) flushes the pending edit instead of dropping it | `src/hooks/use-title-autosave.test.ts` | unit | PASS |

## Coverage and known gaps

- `npx vitest run` (162/162) and `npx tsc --noEmit` confirm zero regressions across the rest of the app.
- **The backfill migration (`20260812000000_backfill_orphaned_space_permissions.sql`) has NOT been applied to the live remote Supabase project.** Writing it into this repo does not, by itself, heal the 7 currently-orphaned Spaces — same caveat as the prior RLS migration. Applying it is a live-database write and needs the project owner's explicit go-ahead (`supabase db push`, or run directly in the Supabase SQL editor).
- The rollback added to `useCreateSpace` is best-effort: if the compensating `spaces.delete()` itself fails (e.g. the same transient condition that broke the Permission insert also breaks this), the Space can still end up orphaned. This is an acceptable residual risk — it only matters for failures during the failure, and the backfill migration is the durable fix for any Space that still slips through.
- No new SQL regression tests were added this round (unlike the prior RLS session) — the RLS policies themselves were not changed, only a plain data backfill and application-level compensation.

## Addendum: the real root cause (found after the user re-reported the bug with a live error screenshot)

The user reported the *exact same* `42501` error (`new row violates row-level security policy for table "permissions"`) still happening on every new Space creation, even after the fixes above. Live reproduction in the actual running app (logged in as the real user) confirmed it, and read-only inspection of the live database turned up something important: **the 7 previously-orphaned Spaces had already been healed** (all had admin Permission rows — the user had evidently applied the backfill migration themselves), yet *new* Spaces created during this same session still failed identically.

### Root cause

`permissions_insert_admin_or_bootstrap`'s bootstrap clause (from `20260806100100_rls_policies.sql`, unchanged by the `20260808000000` fix) was:

```sql
not exists (
  select 1 from public.permissions p where p.space_id = space_id
)
```

The bare `space_id` on the right was meant to correlate to the **new row being inserted** (the policy's own table, `permissions`). But the subquery is *also* against `permissions` (aliased `p`), which has a column literally named `space_id`. Standard SQL scoping resolves an unqualified column reference against the innermost enclosing scope first — so `space_id` bound to `p.space_id`, not the outer new row. The clause was actually `p.space_id = p.space_id`: a tautology, true for **any** existing Permission row on **any** Space.

Practical effect: `not exists(...)` was false as soon as the `permissions` table had *any* row at all, project-wide — not just a row for *this* Space. Bootstrap only ever worked for a User's very first-ever Space creation across the whole system; every subsequent Space by anyone, once at least one Permission row existed anywhere, hit the RLS violation on the bootstrap insert — regardless of whether the RLS *policy itself* was otherwise correctly deployed (which is why the earlier read-only schema-dump verification, which only checked the policy text was live and matched the migration file, didn't catch this — the text was live and matched; the SQL semantics themselves were wrong from the very first migration that introduced this clause).

The same shadowing shape existed in `spaces_select_member_or_publishable`'s bootstrap clause (`not exists (select 1 from public.permissions p where p.space_id = id)` — `permissions` also has its own `id` column, so bare `id` bound to `p.id`, not `spaces.id`). There it failed *open* rather than closed (`p.space_id = p.id` compares unrelated UUID domains and is never true for real data, so the clause was always-permissive) — not the bug the user hit, but the same root cause, fixed at the same time for correctness.

### RED → GREEN (local Supabase via Docker, not production)

Given the environment's permission classifier appropriately blocks live-write-shaped actions against the production database (even a rolled-back transaction), this was verified against a local Supabase stack instead — `supabase start` + `supabase db reset` applies every migration in this repo to a disposable local Postgres.

| Step | Command | Result |
|---|---|---|
| RED | `docker exec -i supabase_db_beacon psql -U postgres < repro-second-space-bootstrap.sql` (same creator, first Space then second Space, exactly replaying `useCreateSpace`'s statement sequence both times) | First Space's bootstrap succeeds; **second Space's permission insert fails** with the exact reported error — reproducing the bug against real Postgres, not a guess |
| GREEN | Added `20260812010000_fix_permissions_bootstrap_column_shadowing.sql` (qualifies the outer reference as `permissions.space_id` / `spaces.id`, unambiguous since the subquery's alias is `p`), `supabase db reset`, rerun same repro | Both Spaces' bootstrap inserts now succeed |
| Regression | Reran the existing `supabase/tests/space-creation-rls.sql` (positive + negative/stranger cases) | All still PASS — no privilege escalation introduced |
| New regression case | Added a "Second-Space" section to `supabase/tests/space-creation-rls.sql` covering exactly this scenario, so it can't regress silently again | PASS |
| Select-policy check | Ad hoc script: creator with an existing Permission row on Space 1 can still see Space 2 during *its* bootstrap window (count 1), and still sees it afterward via normal membership (count 1) | PASS |

Local stack was stopped (`supabase stop`) after verification; nothing here touched production.

### Outstanding: still needs applying to production

**Neither `20260812000000_backfill_orphaned_space_permissions.sql` nor `20260812010000_fix_permissions_bootstrap_column_shadowing.sql` has been applied to the live Supabase project.** The backfill turned out to already have been applied by the user separately (confirmed via read-only query — do not reapply blindly without checking, though the migration is idempotent so a rerun is harmless). The column-shadowing fix — the actual fix for the bug the user is currently hitting — has **not** been applied yet and is the one that matters now. Apply via `supabase db push` or the Supabase SQL editor.
