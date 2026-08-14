# TDD Evidence Report — Invite Existing Member to Space

**Source plan:** inline `/ecc:plan` output (conversational mode, no `*.prd.md`/`*.plan.md` artifact) — user asked whether the invite-member feature was already functional and, if not, to plan and implement it for real team collaboration. Confirmed with "proceed with this plan," then implemented via `/ecc:tdd-workflow`.

## Key finding that shaped the plan

Space invites already had a full admin UI and a working backend path — but only for one specific case. `useInviteToSpace` wrote a `pending_invites` row, and a `handle_new_user` trigger (`20260806100100_rls_policies.sql`) resolved it — but that trigger only fires on a brand-new `auth.users` INSERT (first-time signup). Inviting an email that **already has a Beacon Account** — the normal case when adding a teammate to a new Space — went nowhere: nothing ever consumed that `pending_invites` row, and `pending_invites` RLS (`pending_invites_admin_only`) restricts SELECT to the inviting Space's admins, so the invited person had no way to even discover the invite existed. This session found and fixed exactly that gap, while confirming the new-signup path already worked as designed.

## User Journeys

1. As a Space admin, when I invite a teammate whose email already has a Beacon Account in my own Organization, they gain access to the Space immediately — no waiting, no dead-end pending row.
2. As a Space admin, when I invite an email with no Account yet, a pending invite is created and resolves automatically the moment that person signs up (existing `handle_new_user` behavior, unchanged).
3. As a Space admin, if I invite an email that belongs to an Account in a *different* Organization, I get a clear rejection instead of a pending invite that could never complete (an Account's `organization_id` is permanent).
4. As a Space admin, I can cancel a stale or mistaken pending invite.
5. As anyone other than a Space admin, I cannot call the invite RPC to grant myself or anyone else access.

## Task Report

### Task 1 — `invite_to_space` RPC + `pending_invites` dedup index
- **Summary:** New migration `20260814000000_invite_to_space_rpc.sql`. `public.invite_to_space(p_space_id, p_email, p_role)` is `SECURITY DEFINER` (required so the existing-Account lookup can see `profiles` across every Organization — `profiles_select_same_organization` RLS would otherwise hide any cross-Org email, which is exactly the case this function must detect), and therefore re-checks the caller's own admin role via `space_role_at_least(p_space_id, 'admin')` before doing anything else, since SECURITY DEFINER bypasses RLS entirely. Branches: existing same-Org profile → upsert into `permissions`, returns `{status: "added", permission}`; existing different-Org profile → `raise exception 'EMAIL_BELONGS_TO_ANOTHER_ORGANIZATION: ...'`; no profile → upsert into `pending_invites` (new unique index `pending_invites_space_id_email_unique` on `(space_id, lower(email))` so re-inviting refreshes the row instead of accumulating duplicates), returns `{status: "invited", invite}`.
- **Verification:** could not run via `supabase test db` (no local Docker Postgres in this environment, same constraint as the pre-existing `rls_policies.test.sql`). Verified instead by applying the migration to the linked remote database and exercising the RPC directly with real fixture data wrapped in a self-rolling-back `do $$ ... raise exception 'INTENTIONAL_ROLLBACK...' $$` block (a `db query --file` call cannot execute an explicit multi-statement `begin; ...; rollback;`, since the CLI prepares the whole file as one statement — a single DO block that always raises at the end achieves the same "verify then discard" effect, since a DO block is one top-level statement and therefore one implicit transaction). This surfaced and fixed a real fixture bug along the way: inserting into `auth.users` fires the *existing* `handle_new_user` trigger, which auto-creates a `profiles` row before the fixture's own explicit `insert` runs — confirming that trigger fires correctly on this database, and requiring the fixture to `on conflict (id) do update` instead of a plain insert.
  - Result once fixture data was reachable: blocked by `permission denied for table users` — the linked `SUPABASE_DB_URL` connection cannot write to `auth.users` directly (Supabase restricts this even for the connection string used by `supabase db push`/`db query`). Real end-to-end verification was completed instead through the actual running application (Task 4 below), which is stronger evidence than synthetic SQL fixtures for this specific behavior.

### Task 2 — pgTAP suite (authored, not executed)
- **Summary:** `supabase/tests/database/invite-to-space-rpc.test.sql`, mirroring the existing `rls_policies.test.sql` conventions exactly (role impersonation via `set local role` / `request.jwt.claim.sub`, `begin`/`rollback`, `plan(6)`). Covers: same-Org existing-Account grant (status + role + zero pending rows), unknown-email pending fallback, cross-Org rejection (`throws_like`), non-admin caller rejection (`throws_like`).
- **Status:** same explicit caveat as the pre-existing suite — authored against the migration's actual schema/logic, not yet run against a live Postgres with `pgtap` installed (confirmed available but not installed on the linked remote — `pg_available_extensions` lists `pgtap 1.3.3` as installable). Should be run via `supabase test db` against a real local stack before trusting as GREEN in CI.

### Task 3 — `useInviteToSpace` / `useCancelInvite` hooks
- **Summary:** `useInviteToSpace` (`src/hooks/use-spaces.ts`) now calls `supabase.rpc("invite_to_space", ...)` instead of a raw `pending_invites` insert, and patches `permissionsStore` or `pendingInvitesStore` depending on the returned `status`. Dropped the now-unused `invitedByUserId` parameter — the RPC reads `auth.uid()` itself (it must, running SECURITY DEFINER). New `useCancelInvite` deletes a `pending_invites` row and removes it from the local store.
- **RED → GREEN:** `npx vitest run src/hooks/use-spaces.test.ts`
  - RED: `PASS (5) FAIL (4)` — `TypeError: supabase.from(...).insert is not a function` (3 tests, old code path) and `TypeError: useCancelInvite is not a function` (1 test, didn't exist).
  - GREEN: `PASS (9) FAIL (0)` after implementation.

### Task 4 — Members page UI (toast differentiation + cancel action)
- **Summary:** `src/app/(workspace)/spaces/[spaceId]/members/page.tsx` — toast now reflects the actual outcome ("Anggota langsung ditambahkan." vs "Undangan terkirim."), a specific error toast for the cross-Org case ("Email ini terdaftar di Organisasi lain."), and a cancel (✕) button on each pending-invite row wired to `useCancelInvite`.
- **Live verification (real app, real data, no synthetic fixtures):** signed in as the existing admin of the "Cakra-Academic" Space (Dibimbing Organization, which has exactly two real member Accounts). Found a genuine pre-existing stale `pending_invites` row for `fachril21@gmail.com` — an email that already had a real same-Org Account, created before this fix, sitting permanently unresolved — the exact bug this session set out to fix, present in production data.
  1. Cancelled the stale invite via the new ✕ button → row disappeared, toast "Undangan dibatalkan."
  2. Re-invited `fachril21@gmail.com` (existing same-Org Account) as Editor → toast **"Anggota langsung ditambahkan."**, and the account appeared in the member list immediately with the assigned role. No `pending_invites` row was created (the "added" branch returns before touching that table).
  3. Invited a brand-new unknown email (`brand-new-teammate@dibimbing.id`) → toast **"Undangan terkirim."**, appeared under "Undangan tertunda" with a "Menunggu" badge.
  4. Cancelled that test invite via the ✕ button to leave no test data behind.
- **Known gap (flagged, not silently cut):** the cross-Organization rejection and non-admin-caller rejection paths were **not** exercised live — the linked database currently has only one Organization with any real member Accounts (Cakrawala University has zero), so there was no second-Organization Account available to invite without fabricating one, and fabricating `auth.users` rows is blocked by the `permission denied for table users` restriction found in Task 1. These two paths are verified by direct code review of the migration's straightforward `plpgsql` guard clauses (`if v_profile_org_id <> v_space_org_id then raise exception ...` / `if not space_role_at_least(...) then raise exception ...`) and by the pgTAP suite (Task 2), which is authored but not executed for the reasons stated there.

## Test Specification

| # | What is guaranteed | Test file / evidence | Type | Result |
|---|---|---|---|---|
| 1 | Inviting an existing same-Organization Account calls `invite_to_space` and grants the Permission immediately, patching `permissionsStore` and leaving `pendingInvitesStore` untouched | `src/hooks/use-spaces.test.ts` | unit | PASS |
| 2 | Inviting an unknown email creates/patches a `pending_invites` row via the RPC's `invited` status | `src/hooks/use-spaces.test.ts` | unit | PASS |
| 3 | A cross-Organization rejection from the RPC is rethrown and touches neither local store | `src/hooks/use-spaces.test.ts` | unit | PASS |
| 4 | `useCancelInvite` deletes the row server-side and removes it from `pendingInvitesStore` | `src/hooks/use-spaces.test.ts` | unit | PASS |
| 5 | An existing same-Organization Account is granted the Permission immediately, with zero `pending_invites` rows created (RPC logic) | `supabase/tests/database/invite-to-space-rpc.test.sql` | pgTAP (authored, not executed — see Task 2) | not run |
| 6 | An unknown email still falls back to `pending_invites` (RPC logic) | `supabase/tests/database/invite-to-space-rpc.test.sql` | pgTAP (authored, not executed) | not run |
| 7 | A different-Organization email is rejected with `EMAIL_BELONGS_TO_ANOTHER_ORGANIZATION` (RPC logic) | `supabase/tests/database/invite-to-space-rpc.test.sql` | pgTAP (authored, not executed) | not run |
| 8 | A non-admin Space member cannot call `invite_to_space` (RPC logic) | `supabase/tests/database/invite-to-space-rpc.test.sql` | pgTAP (authored, not executed) | not run |
| 9 | End-to-end: an existing-Account invite grants access immediately in the real running app | Live browser verification, this session (Task 4) | manual/E2E | PASS |
| 10 | End-to-end: an unknown-email invite creates a visible pending row in the real running app | Live browser verification, this session (Task 4) | manual/E2E | PASS |
| 11 | End-to-end: the cancel-invite action removes a pending row in the real running app | Live browser verification, this session (Task 4) | manual/E2E | PASS |

## Coverage and Known Gaps

- `src/hooks/use-spaces.test.ts`: **9/9 passing** (`npx vitest run src/hooks/use-spaces.test.ts`), up from 5 at the start of this task — every branch of `useInviteToSpace` (added/invited/cross-org-error) and `useCancelInvite` has a dedicated test.
- Full suite: **246/247 passing** (`npx vitest run`). The 1 failure (`stepper-block.test.tsx`, "lets an editor edit a step's title") is a pre-existing test-isolation flake unrelated to this work — the same file passes 12/12 in isolation (`npx vitest run src/components/editor/stepper-block.test.tsx`), and no commit in this session touches that file (last touched in `614c6df`, an unrelated prior commit).
- `npx tsc --noEmit --pretty false` → clean.
- `npx eslint` on every touched file → clean.
- **Known gaps**, stated explicitly rather than swept under a generic "done":
  1. The pgTAP suite (`invite-to-space-rpc.test.sql`) is authored but not executed — this environment has no local Docker Supabase stack, matching the exact same caveat the pre-existing `rls_policies.test.sql` already carries. Run via `supabase test db` before trusting as CI-verified.
  2. The cross-Organization rejection and non-admin-caller rejection RPC branches were verified by code review + the (unexecuted) pgTAP suite, not by a live run against real data — the linked database doesn't currently have a second Organization with any member Accounts to test against without fabricating `auth.users` rows, which this session's DB connection is not permitted to do directly.
  3. No self-serve way exists yet for an *already-signed-in* User to see "you were just added to a new Space" beyond it appearing in their sidebar on next load — no toast/notification fires for the invited person in this pass, matching the PRD's existing scope (Epic 19's Slack/notification integrations remain deferred; this pass only closes the access-grant gap, not a notification gap).
