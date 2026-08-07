# Stage 3 — Engagement & Collaboration Layer — TDD Evidence Report

**Source plan:** `PRD.md` §9 "Stage 3 — Engagement & Collaboration Layer", Epics 15–17. No separate `*.plan.md` was supplied; journeys below are PRD.md's own user stories (US15.1–US17.2), scoped by an exploration pass over the existing Stage 1 mock UI/hooks before any code was written (see commit history for the three checkpoint commits).

**Session context:** unlike Stage 2's original session (no Docker/Supabase/S3 available at all), this session had a **live, already-migrated remote Supabase instance** and a **running local MinIO** (see `docs/testing/stage-2-backend-integration.tdd.md`'s "Session 2" section). However, this session still has **no working `psql`** (checked: `C:\Program Files\PostgreSQL\17\bin` doesn't actually contain `psql.exe` despite being on `PATH`) and the **`supabase` CLI is authenticated but not linked to this project** (`supabase projects list` doesn't show it). This means: every hook/UI change below was verified for real against the live database's *existing* schema (Comments/Feedback/Permissions tables and their RLS were all already created in Epic 9's migration — confirmed by reading `20260806100000_initial_schema.sql` and `20260806100100_rls_policies.sql` directly). The **two new migrations this session adds** (feedback rate-limiting, notifications) are written and included in `supabase/migrations/`, but **not yet applied to the live database** — same handoff situation as Stage 2's GRANT-statement fix: they need to be run manually (SQL Editor or a working `psql`) before Epics 15's rate limit and 16's notifications function against the real database.

## User journeys covered

Directly from PRD.md's Stage 3 epics:
- US15.1 — Viewer feedback submissions persist as real `Feedback` rows, rate-limited per IP.
- US15.2 — User sees the real aggregate helpfulness rate for their published pages.
- US16.1 — User's comment-panel UI (Epic 8c) persists real, per-block comments.
- US16.2 — Mentioning another User (`@name`) sends them a real notification.
- US17.1 — Space admin's Members UI assigns real roles enforced by RLS (confirmed already done in an earlier Stage 2 session — see Task report below).
- US17.2 — A viewer-role User's UI correctly hides/disables edit and publish actions.

## Task report

### Epic 17 — Roles & Permissions
- **Summary:** Investigation (via a research subagent reading `use-spaces.ts`, the Members page, and the page editor/toolbar in full) found US17.1 already fully implemented against real Supabase in an earlier session (`useUpdateSpaceRole`, `useInviteToSpace`, the whole Members page — zero mock-store usage). The only remaining gap was US17.2: the page editor and toolbar had **zero role checks** — a viewer could type in the title field and see live Publish/Update/Unpublish buttons, even though the `pages_update_editor` RLS policy would silently reject the actual write.
- **RED:** `page-editor-toolbar.test.tsx` (new file, 5 tests) asserted the Publikasikan/Perbarui buttons are absent for `role="viewer"` and `role={null}`; 3/5 failed against the toolbar's then-unconditional rendering.
- **GREEN:** `npx vitest run src/components/editor/page-editor-toolbar.test.tsx` — 5/5 passing after adding a `role` prop and gating Publish/Update/Unpublish/overflow-Unpublish on `role === "editor" || role === "admin"`. `PageEditorPage` now computes `role` via the already-real `useSpaceRole` and threads `editable={canEdit}` into `PageEditor`'s Lexical `initialConfig` plus makes the title `<input readOnly>`.
- **What is guaranteed:** for the 5 tested role/publish-state combinations, the toolbar's DOM never contains a Publish/Update/Unpublish button when the current user's Space role is viewer or absent — a real component-level guarantee (RTL renders the actual `PageEditorToolbar` component, not a mock of it). The underlying security boundary was already RLS (`pages_update_editor` requires editor+, verified in Stage 2), so this closes the UX-level AC without changing what's actually enforceable.

### Epic 15 — Feedback Integration
- **Summary:** `use-feedback.ts` was still 100% Stage-1 mock (`src/lib/data-store.ts`). Rewired to real Supabase, following the exact mapper/store/`ensureLoaded` pattern every other Stage 2 hook uses (`FeedbackRow`/`mapFeedbackRow` added to `mappers.ts`, `feedbackStore` added to `stores.ts`).
- **RED:** `use-feedback.test.ts` (6 tests) written against the real-Supabase contract (including `useCreateFeedback` becoming async); 4/6 failed against the old synchronous mock-store version (the other 2 — `usePageFeedback`/`useHelpfulnessRate` returning empty for an `undefined` pageId — happened to already hold).
- **GREEN:** `npx vitest run src/hooks/use-feedback.test.ts` — 6/6 passing. `FeedbackWidget` now `await`s the async `useCreateFeedback` with a retry-toast on failure instead of assuming success.
- **US15.2 (helpfulness rate UI):** did not exist anywhere before this session (confirmed via `Grep` — `useHelpfulnessRate` had zero call sites). Added to `PageEditorToolbar`: "`<rate>`% membantu (N respons)" shown to editors/admins on a published page with ≥1 response. 3 new tests in `page-editor-toolbar.test.tsx` cover: shown to an admin with data, hidden with zero responses, and — critically — **never shown to a viewer even if the hook returned data** (defense in depth alongside the real RLS restriction, since `feedback_select_editor` already blocks a viewer's query from returning anything in practice).
- **US15.1 (per-IP rate limiting):** PRD.md's architecture note calls for a Supabase Edge Function. Not built — see "Known deviations" below. Implemented instead as `supabase/migrations/20260807000000_feedback_rate_limit.sql`: a `feedback_rate_limits` tracking table plus a `SECURITY DEFINER` Postgres function (`feedback_rate_limit_ok`) that reads `x-forwarded-for` from `current_setting('request.headers')` (the documented Supabase pattern for this exact problem) and is called from inside the existing `feedback_insert_public_on_published` policy's `with check`. **This migration is written but not yet run against the live database** (no `psql`/linked CLI this session) — it needs to be applied before the rate limit is actually enforced.

### Epic 16 — Comments & Mentions
- **Summary:** `use-comments.ts` was also still 100% Stage-1 mock. Rewired the same way (`CommentRow`/`mapCommentRow`, `commentsStore`).
- **RED:** `use-comments.test.ts` (4 tests) — all 4 failed against the mock implementation (empty array instead of loaded rows; insert mock never called).
- **GREEN:** `npx vitest run src/hooks/use-comments.test.ts` — 4/4 passing. `CommentThreadPanel` now awaits the async `useCreateComment` with an error toast.
- **US16.2 (real notifications) — the one genuinely new subsystem in Stage 3.** Confirmed via `Grep` across `src/`, `supabase/`, `docs/` that **no notification mechanism existed anywhere** before this session (the only hits were a mock page literally titled "page-notifications" and unrelated Supabase Auth email-template config). Built from scratch:
  - `supabase/migrations/20260807000100_notifications.sql` — `notifications` table + 3 RLS policies (select-own, insert-by-the-commenter-gated-by-Space-membership, update-own-to-mark-read). **Written, not yet applied to the live database**, same as the rate-limit migration.
  - `use-notifications.ts` (4 new tests, all passing): `useNotifications`, `useUnreadNotificationCount`, `useMarkNotificationRead`. Deliberately **not** built on Supabase Realtime — Epic 18 ("Real-time Collaboration") is explicitly Stage 4 in PRD.md, deferred. A 20-second poll interval is used instead, which comfortably satisfies US16.2's "within 1 minute" delivery AC without pulling in Realtime early.
  - `useCreateComment` now inserts one `notifications` row per mentioned user (excluding the author mentioning themselves) after the comment insert succeeds; a failed notification insert is logged, not thrown — the comment itself is the primary action and shouldn't roll back over a secondary one.
  - `NotificationBell` (new component, `src/components/workspace/`) wired into `WorkspaceSidebar` next to the existing Settings icon: unread-count badge, popover listing actor/page/timestamp, click marks read and navigates to the page.

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | Publish/Update/Unpublish buttons never render for `role="viewer"` or `role=null`, but do for editor/admin | `src/components/editor/page-editor-toolbar.test.tsx` | component | PASS (5) |
| 2 | Helpfulness rate shown to editor/admin with responses, hidden with zero responses, hidden for viewer regardless of data | `src/components/editor/page-editor-toolbar.test.tsx` | component | PASS (3) |
| 3 | `usePageFeedback`/`useHelpfulnessRate` load and derive correctly from real Supabase rows; empty/null for undefined pageId | `src/hooks/use-feedback.test.ts` | unit | PASS (4) |
| 4 | `useCreateFeedback` inserts via Supabase and propagates a rejection (e.g. rate-limit/RLS denial) to the caller | `src/hooks/use-feedback.test.ts` | unit | PASS (2) |
| 5 | `usePageComments`/`useBlockComments` load, map, filter-by-block, and sort ascending by createdAt from real Supabase rows | `src/hooks/use-comments.test.ts` | unit | PASS (2) |
| 6 | `useCreateComment` inserts the comment, patches the store, and inserts exactly one notification per mentioned user excluding self-mentions | `src/hooks/use-comments.test.ts` | unit | PASS (2) |
| 7 | `useNotifications` loads the current user's own notifications newest-first; empty for undefined userId, no query issued | `src/hooks/use-notifications.test.ts` | unit | PASS (2) |
| 8 | `useUnreadNotificationCount` counts only `is_read = false` rows | `src/hooks/use-notifications.test.ts` | unit | PASS (1) |
| 9 | `useMarkNotificationRead` updates `is_read` via Supabase and patches the store | `src/hooks/use-notifications.test.ts` | unit | PASS (1) |
| — | Full test suite | (all above + pre-existing) | unit/component | **103/103 PASS** |
| — | Project typecheck | `npx tsc --noEmit` | static | PASS, 0 errors, both after Epic 17 and after Epic 16 |
| — | `feedback_rate_limit_ok`, `notifications` RLS policies | new migrations | SQL | **NOT RUN** — no psql/linked CLI this session; written and included in `supabase/migrations/`, needs manual application |

## Coverage and known gaps

```
All files          |   65.47 |    52.13 |    61.9 |   70.17 |
ERROR: Coverage for lines/functions/statements/branches does not meet the 80% global threshold
```

Same pre-existing gap as Stage 2's report (65.71%→65.47% — essentially unchanged; new Stage 3 code was tested at roughly the same density as the rest of the codebase, so it didn't move the needle much either way). Not addressed this session — same reasoning as Stage 2: focused tests on the trickiest/highest-value logic (mutation paths, role gating, notification fan-out) rather than exhaustive coverage of every thin selector.

## Known deviations from the PRD's stated architecture

1. **US15.1's Edge Function → Postgres trigger substitution.** PRD.md/PROJECT.md frame per-IP feedback rate-limiting as a Supabase Edge Function. This session couldn't deploy one — `supabase projects list` (CLI is authenticated) doesn't show this project under the linked account, so `supabase functions deploy` has nowhere to push to. Substituted an equivalent Postgres-level throttle (tracking table + `SECURITY DEFINER` function invoked from the RLS `with check`) that achieves the same database-layer guarantee. Documented in the migration file's own header comment, not just here.
2. **US16.2 notifications → no Supabase Realtime.** Real-time delivery would use Supabase Realtime, but Epic 18 ("Real-time Collaboration (Supabase Realtime)") is explicitly named as Stage 4 / deferred in PRD.md §9. A 20-second poll satisfies the literal "within 1 minute" AC without pulling that dependency in early. If Epic 18 is later built, `use-notifications.ts`'s poll loop is the natural place to swap in a Realtime subscription.
3. **Both new migrations (rate-limit, notifications) are unapplied.** No `psql` binary exists on this machine despite a stale `PATH` entry pointing at one, and the `supabase` CLI's authenticated account doesn't have this project linked. These need to be run manually (Supabase SQL Editor, or a working `psql`/`supabase db push` from an environment that has access) before Epic 15's rate limit or Epic 16's notifications function against real data. Everything downstream of that (the hooks, the UI) is tested against the *shape* these migrations produce, via mocked Supabase responses — not against the live tables, which don't exist yet.

## Merge evidence

Three checkpoint commits, one per epic, each containing its own RED→GREEN summary in the commit body (Epic 17, Epic 15, Epic 16, in that implementation order since 17 required no new schema and could be verified fastest). If squashed later, this report's "Task report" section is the summary to carry forward, along with the three "Known deviations" above — those are the parts most likely to matter to a future reader who wasn't in this session.
