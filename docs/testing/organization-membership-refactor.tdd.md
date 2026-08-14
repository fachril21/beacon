# TDD Evidence Report — Organization-Level Membership & Invitations Refactor

**Source plan:** produced inline via `/ecc:plan` (conversational mode, no `.claude/plans/*.plan.md` artifact — user confirmed with "yes"), then executed via `/ecc:tdd-workflow`.

## Context

Beacon's Organization/Space/Page model previously assumed exactly one Organization per User (`profiles.organization_id` NOT NULL FK, binary `owner`/`member` role) with no self-serve Organization creation and invitations living only at the Space level (`pending_invites`). This refactor moves invitations to the Organization level with a real many-to-many membership model (`OrganizationMembership`), OWNER/ADMIN/MEMBER roles with a unique-owner-per-org invariant, self-serve Organization creation, and org membership as a hard prerequisite for all Space/Page access.

## User Journeys

1. As any signed-in user with no Organization, I can create my own Organization and become its sole OWNER immediately.
2. As an OWNER or ADMIN, I can invite someone by email; if they already have a Beacon Account they join immediately, otherwise they get a real invite email and join after signing up.
3. As an OWNER, I can revoke a still-PENDING invitation, transfer ownership to another member (my own role becomes ADMIN), and remove members (except the current OWNER, who must be transferred first).
4. As any User, losing my Organization membership silently loses me access to every Space/Page inside that Organization, even if a Space-level Permission row is still sitting there.
5. As an OWNER/ADMIN of a Space's Organization, I can only grant that Space's access to people already in the Organization — there is no separate Space-level email-invite path anymore.
6. As an operator of this existing (pre-production) database, every existing User's Organization membership and every still-pending Space-level invite survives the migration with no data loss.

## Task Report

### Task 1 — Schema + org-membership RLS gate
- **Summary:** `organization_memberships` (unique-owner-per-org partial index) and `organization_invitations` tables; `user_space_role()` — the single helper every Space/Page/ScreenshotBlock/Version/Comment policy already routes through — now requires an `organization_memberships` row, gating all of them from one change; a write-time trigger additionally blocks any `permissions` row for a non-org-member.
- **RED:** `docker exec -i supabase_db_beacon psql -U postgres < supabase/tests/organization-membership-rls.sql` against a stack with none of the new migrations applied — `ERROR: relation "public.organization_memberships" does not exist`. Confirmed failing for the intended reason.
- **GREEN:** Same command after `20260815000000_organization_membership_schema.sql` + `20260815000100_organization_membership_gate.sql` — all 5 cases pass (owner bootstrap, exactly-one-owner-per-org, real-member Space access, write-time rejection of a non-member Permission row, read-time rejection of a stale Permission row after org removal).
- **Note:** hit and fixed a self-referential RLS recursion (`ERROR: infinite recursion detected in policy for relation "organization_memberships"`) — same failure shape this repo already fixed once for `permissions`/`spaces` (`20260808000000_fix_permissions_bootstrap_rls_recursion.sql`); fixed the same way, routing self-checks through SECURITY DEFINER helpers.
- **Guarantees:** org membership is a hard prerequisite for Space/Page access, enforced at both read time (RLS) and write time (trigger); exactly one OWNER per Organization, DB-enforced.

### Task 2 — Organization invite/membership RPCs
- **Summary:** `invite_to_organization`, `accept_organization_invite`, `transfer_organization_ownership`, `remove_organization_member` (SECURITY DEFINER, mirroring `invite_to_space`'s shape).
- **RED:** `supabase/tests/organization-invite-rpcs.sql` — `ERROR: function public.invite_to_organization(unknown, unknown, unknown) does not exist`.
- **GREEN:** Same script after `20260815000200_organization_rpcs.sql` — all 7 cases pass (existing-account immediate invite, unknown-email pending invite + dedupe, non-owner/admin rejected, wrong-user token rejected, email-matched accept + idempotent re-accept, atomic ownership transfer with stale-owner rejection, `CANNOT_REMOVE_OWNER` guard).
- **Guarantees:** ownership transfer is atomic (never two OWNER rows visible for the same org); an invite token only ever accepts for the matching email; re-accepting an already-accepted token is a no-op, not an error.

### Task 3 — Data backfill + retire Space-level invites
- **Summary:** Every existing `profiles.organization_id`/`organization_role` row backfilled into `organization_memberships` before the source columns were dropped (same migration — no later point could still read them); any still-PENDING `pending_invites` row migrated forward into `organization_invitations` (role narrows to `member` — a Space-level `SpaceRole` has no Organization-level equivalent); `pending_invites` table and `invite_to_space` function dropped.
- **GREEN:** All three raw-SQL regression suites (`organization-membership-rls.sql`, `organization-invite-rpcs.sql`, `space-creation-rls.sql`) re-run together against the full migration set — all pass. `space-creation-rls.sql` and `rls_policies.test.sql` fixtures updated for the new schema (signup no longer auto-assigns an Organization).
- **Guarantees:** no existing membership or pending invitation is silently discarded by the migration.

### Task 4 — Application layer (types, mappers, hooks)
- **Summary:** `OrganizationMembership`/`OrganizationInvitation` types; `User.organizationRole` removed (role is now per-membership); `useMyOrganizations`, `useOrganizationRole`, `useCreateOrganization`, `useOrganizationMembers`, `useOrganizationInvitations`, `useInviteToOrganization`, `useRevokeInvitation`, `useRemoveOrgMember`, `useTransferOwnership`, `useAcceptOrganizationInvite`; `useAddOrgMemberToSpace` replaces `useInviteToSpace`/`useCancelInvite`.
- **RED:** `npx vitest run src/hooks/use-organizations.test.ts` — `TypeError: useCreateOrganization is not a function` (and 7 siblings). Confirmed failing for the intended reason.
- **GREEN:** Same command — `PASS (20) FAIL (0)`. Full suite: `PASS (278) FAIL (0)`.
- **Guarantees:** `useCreateOrganization` rolls back the Organization row if the bootstrap membership insert fails (no inaccessible orphan), mirroring `useCreateSpace`'s existing guarantee.

### Task 5 — API routes + invite-acceptance auth flow
- **Summary:** `POST /api/organizations/[id]/invite` (mirrors the Space-invite route); `/accept-invite` page (immediate accept when signed in, sessionStorage-stashed token + workspace-layout onboarding gate when not); zero-Organization onboarding screen; Organization Settings → Members tab; Space Members page's email-invite form replaced with an Organization-roster picker.
- **RED:** `npx vitest run "src/app/api/organizations/[id]/invite/route.test.ts"` — `Failed to resolve import "./route"` (module didn't exist).
- **GREEN:** Same command — `PASS (5) FAIL (0)`.
- **Validation:** `npx tsc --noEmit --pretty false` → `No errors found`. `npx eslint .` → `No issues found` (fixed two `react-hooks/set-state-in-effect` violations along the way by deriving state instead of setting it synchronously in an effect body). Full suite: `PASS (278) FAIL (0)`.
- **Not independently unit-tested:** `/accept-invite/page.tsx`, `CreateOrganizationOnboarding`, the rewritten Organization Settings and Space Members pages — thin UI shells, consistent with this repo's existing convention (no prior test files exist for any `(auth)` page or the old `(public)/layout.tsx`; validated instead via typecheck/lint/full-suite, per `docs/testing/organization-settings-completion.tdd.md`).

## Test Specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | Org-membership bootstrap: creator claims the sole OWNER row | `supabase/tests/organization-membership-rls.sql` | RLS regression | PASS |
| 2 | Exactly one OWNER per Organization (DB-enforced) | same | RLS regression | PASS |
| 3 | A real org member can create a Space + bootstrap their own admin Permission | same | RLS regression | PASS |
| 4 | A non-org-member's Permission insert is rejected at write time | same | RLS regression | PASS |
| 5 | A stale Permission row (org membership since removed) grants zero access at read time | same | RLS regression | PASS |
| 6 | Existing-account org invite grants membership immediately, no invitation row | `supabase/tests/organization-invite-rpcs.sql` | RLS/RPC regression | PASS |
| 7 | Unknown-email invite creates a PENDING invitation; re-invite dedupes | same | RLS/RPC regression | PASS |
| 8 | Non-owner/admin cannot invite | same | RLS/RPC regression | PASS |
| 9 | An invite token only accepts for the matching email | same | RLS/RPC regression | PASS |
| 10 | Re-accepting an already-accepted token is idempotent | same | RLS/RPC regression | PASS |
| 11 | Ownership transfer is atomic; a stale (former) owner can't transfer again | same | RLS/RPC regression | PASS |
| 12 | The current OWNER cannot be removed without a prior transfer | same | RLS/RPC regression | PASS |
| 13 | `useCreateOrganization` rolls back on bootstrap-membership failure | `src/hooks/use-organizations.test.ts` | unit | PASS |
| 14 | `useMyOrganizations`/`useOrganizationRole` reflect only the caller's own memberships | same | unit | PASS |
| 15 | `useInviteToOrganization`/`useRevokeInvitation`/`useRemoveOrgMember`/`useTransferOwnership`/`useAcceptOrganizationInvite` call the right endpoint/RPC and patch the store correctly, including error paths | same | unit | PASS |
| 16 | `useAddOrgMemberToSpace` grants access via a plain permissions insert, surfacing `NOT_ORGANIZATION_MEMBER` without touching the store on failure | `src/hooks/use-spaces.test.ts` | unit | PASS |
| 17 | `POST /api/organizations/[id]/invite` — added/invited/403/401 branches, invite token embedded in `redirectTo` | `src/app/api/organizations/[id]/invite/route.test.ts` | integration | PASS |
| 18 | Row → entity mapping for `OrganizationMembership`/`OrganizationInvitation` | `src/lib/supabase/mappers.test.ts` | unit | PASS |

## Coverage and Known Gaps

- Full suite: `278/278` passing (`npx vitest run`), `npx tsc --noEmit` clean, `npx eslint .` clean.
- `npx vitest run --coverage`: global thresholds (80% lines/functions/statements/branches) are **not met** at the whole-repo level (64.7% statements / 54.89% branches / 64.86% functions / 68.15% lines) — this reflects the entire ~1900-statement codebase, dominated by pre-existing, unrelated UI surfaces (the BlockNote editor, the annotation canvas, etc.) that predate this session and were never in its scope. This session's own new logic has dedicated, passing tests at every layer that has one in this codebase's existing convention (SQL regression for RLS/RPCs, vitest unit tests for hooks/mappers/routes); UI page shells follow this repo's established pattern of typecheck+lint+full-suite validation instead of per-component unit tests (see `docs/testing/organization-settings-completion.tdd.md`'s identical treatment of `(public)/layout.tsx`).
- pgTAP suites (`supabase/tests/database/*.test.sql`) remain unexecuted in this environment (pgTAP extension not installed locally) — same pre-existing caveat noted in their own file headers before this session. `rls_policies.test.sql`'s fixtures were updated for the new schema so it stays valid whenever pgTAP is available; `invite-to-space-rpc.test.sql` was removed (tested the now-dropped `invite_to_space`).
- Out of scope for this session: an Organization switcher UI for a User belonging to more than one Organization (mentioned as a possible follow-up in the original plan, not required by any confirmed acceptance criterion); Playwright/browser verification of the new UI flows (no live dev server was exercised in this session — all verification is typecheck/lint/unit/SQL-regression).

## Merge Evidence

Git checkpoints on `development` (chronological):
1. `test: add reproducer for organization membership + Space/Page access gate` — RED
2. `feat: add organization_memberships/invitations schema + org-membership RLS gate` — GREEN
3. `test: add reproducer for organization invite/membership RPCs` — RED
4. `feat: add organization invite/membership RPCs` — GREEN
5. `feat: backfill organization_memberships and retire Space-level invites` — migration + legacy cleanup, all 3 SQL suites green together
6. `test: add reproducers for new organization hooks + fix stale org fixtures` — RED
7. `feat: add multi-org membership hooks (useMyOrganizations, useCreateOrganization, invites)` — GREEN
8. `test: add reproducer for POST /api/organizations/[id]/invite` — RED
9. `feat: add POST /api/organizations/[id]/invite` — GREEN
10. `feat: add invite-acceptance flow and Organization Settings > Members UI` — UI layer, full suite green, tsc clean, eslint clean
