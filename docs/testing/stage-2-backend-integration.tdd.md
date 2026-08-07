# Stage 2 Backend Integration — TDD Evidence Report

**Source plan:** `PRD.md` §9 "Stage 2 — Backend Integration (Supabase + S3/MinIO wiring)", Epics 9–14a. No separate `*.plan.md` was supplied; this report was derived directly from the PRD during this session.

**Session constraints (read this first):** no Docker, no local Postgres, and no Supabase/AWS/Vercel credentials were available in this environment. Every RED/GREEN cycle below is against a **mocked Supabase client** (`vi.mock("@/lib/supabase/client", ...)`), not a live database. SQL migrations were syntax-validated offline via `libpg-query` (the same parser Postgres itself uses) but **never executed against a real Postgres instance**. This is the single biggest caveat on everything in this report — see "Known gaps" below before trusting any RLS/schema claim as verified.

## User journeys covered

Directly from PRD.md §8's flows, scoped to what Epics 9–14a touch:
- Flow 1 (Account Creation & Login) — real Supabase Auth, Epic 10.
- Flow 2 (Workspace Home & Space/Page creation) — real Space/Page persistence, Epic 11.
- Flow 3 (Authoring, screenshot upload) — real S3/MinIO upload, real autosave with offline/crash recovery, Epics 11–12.
- Flow 4 (Publish/Update/Unpublish) — atomic RPC, Epic 13.
- Flow 5 (Viewer browsing the public site) — real anonymous RLS-governed queries, Epic 13.
- Flow 6 (Internal search) / part of Flow 5 (public search) — real Postgres full-text search, Epic 14.
- Flow 7 / 7a (Space permissions, Organization domain settings) — real Space permission bootstrap, org domain updates, Epic 11 (verification itself deferred, Epic 14a).

## Task report

### Epic 9 — Supabase Schema & RLS Policies
- **Summary:** Wrote `supabase/migrations/20260806100000_initial_schema.sql` (every entity table) and `20260806100100_rls_policies.sql` (RLS policies + `handle_new_user` signup trigger), plus `supabase/seed.sql` (the two known Organizations) and a pgTAP suite at `supabase/tests/database/rls_policies.test.sql`.
- **Validation run:** `node -e "require('libpg-query').parse(...)"` against all three SQL files — offline syntax check only.
- **Real bug caught during authoring (not by any test — by re-reading the policy):** the original single `permissions` admin-only policy made it impossible to ever insert a Space's first admin row, since nobody is admin of a brand-new Space yet. Fixed by splitting INSERT from UPDATE/DELETE with a narrow bootstrap clause (the Space's own creator, only while no permission row exists yet).
- **What is guaranteed:** nothing yet, against a real database — the pgTAP suite is written and includes the exact ACs Epic 9 asks for (anon reads 0 rows on internal content, viewer-role write affects 0 rows, non-owner domain update affects 0 rows, admin/owner writes succeed, the bootstrap permission insert works for the creator and fails for anyone else) but has **not been run** (`supabase test db` requires a reachable local Supabase stack this session didn't have).

### Epic 10 — Auth Integration
- **Summary:** `src/hooks/use-session.ts` rewritten to call `supabase.auth.signInWithPassword` / `signUp` / `signOut` / `onAuthStateChange`, fetching the matching `profiles` row to build the `User` object.
- **RED:** `use-session.test.ts` written against the new contract (`isLoading` flag, real Supabase calls) — 6/6 failing against the old localStorage mock.
- **GREEN:** `npx vitest run src/hooks/use-session.test.ts` — 6/6 passing.
- **What is guaranteed:** `InvalidCredentialsError`/`EmailAlreadyRegisteredError` are thrown for both of Supabase's "already registered" signals (explicit error, and the anti-enumeration empty-`identities` fake-success) — verified against a mocked client, not Supabase's real behavior.

### Epic 11 — Space/Page/Block Data Integration
- **Summary:** `use-organizations.ts`, `use-spaces.ts`, `use-pages.ts` (CRUD), `use-versions.ts`, `use-users.ts` rewritten to call Supabase via a new shared `src/lib/supabase/collection-store.ts` (async-loading `Store<T[]>`). Added `src/lib/offline-buffer.ts` (IndexedDB, via `idb`) and rewired `use-page-autosave.ts` so failed/offline saves actually persist and retry, rather than only simulating failure via a dev toggle.
- **RED/GREEN:** every hook file has a matching `.test.ts`; `collection-store.test.ts` (6 tests, load-once-per-key/merge-by-id/invalidate/retry-after-failure) and `offline-buffer.test.ts` (5 tests, against `fake-indexeddb`) are the two most load-bearing.
- **Real bug caught:** `persistNow`'s retry closure in `use-page-autosave.ts` referenced itself before full assignment (`react-hooks/immutability` lint error) — fixed with the standard latest-ref pattern.
- **Command:** `npx vitest run src/hooks/use-organizations.test.ts src/hooks/use-spaces.test.ts src/hooks/use-pages.test.ts src/hooks/use-versions.test.ts src/hooks/use-users.test.ts src/lib/offline-buffer.test.ts src/lib/supabase/collection-store.test.ts` — all passing.
- **What is guaranteed:** the create-Space-then-bootstrap-admin-permission two-step write order; `useCreatePage`'s order computed via a server-side count rather than a possibly-stale local array; autosave persists to IndexedDB on failure/offline and flushes on both reconnect and next mount — all against a mocked client.

### Epic 12 — Image Upload Integration (S3/MinIO)
- **Summary:** `/api/s3/presign` (Next.js Route Handler) issues a presigned POST (`@aws-sdk/s3-presigned-post`) with a `content-length-range` policy condition after checking the caller's Supabase session server-side. `use-screenshot-blocks.ts` gained `useUploadScreenshot` (presign → direct-to-S3 POST → DB insert). `docker-compose.yml` adds a MinIO + bucket-init service, wired to `predev`.
- **RED/GREEN:** `src/lib/s3/presign.test.ts` (5 tests: object-key generation, presigned-POST conditions) and `use-screenshot-blocks.test.ts` (4 tests, including "S3 upload fails → no DB row created") both RED before their implementations existed, GREEN after.
- **Explicitly untested:** `route.ts` itself (thin wiring around Next's `Request`/cookies — kept thin, logic delegated to tested functions) and the MinIO container itself (never started — no Docker this session).

### Epic 13 — Publishing Integration
- **Summary:** `supabase/migrations/20260806100200_publishing_rpcs.sql` adds `publish_page`/`update_published_page`/`unpublish_page` (SECURITY INVOKER, atomic `is_published` + `published_content_snapshot` write, snapshot built via `jsonb_object_agg` over `screenshot_blocks`). `usePublishActions` now calls these via `supabase.rpc()`. `use-public-content.ts` now queries Supabase directly (anon-role, RLS-governed) instead of mock data, explicitly scoped by `organizationId` at the query level.
- **RED/GREEN:** `use-pages.test.ts`'s `usePublishActions` describe block (3 tests) and `use-public-content.test.ts` (4 tests, including "different Organization → null, never a fallback").
- **Untested:** the RPC functions' actual atomicity and RLS enforcement — SQL-syntax-checked only, never executed.

### Epic 14 — Search Integration
- **Summary:** `supabase/migrations/20260806100300_search.sql` adds `pages.search_text` (denormalized plain text — `content` is a Lexical JSONB tree, impractical to walk in PL/pgSQL) and a generated `search_vector` (`'simple'` config — no Bahasa Indonesia stemming exists in Postgres's built-in dictionaries) with a GIN index. `useUpdatePageContent` keeps `search_text` in sync via the existing `extractPlainText`. `use-search.ts` now runs `.textSearch("search_vector", ...)` for both internal (RLS-scoped) and public (explicitly org-scoped) search.
- **RED/GREEN:** `use-search.test.ts` (5 tests) and the added `use-pages.test.ts` case asserting `search_text` is included in every content-update payload.

### Epic 14a — Multi-Domain Routing (logic only, live verification deferred by explicit user choice)
- **Summary:** `src/lib/organization-resolution.ts` (pure: host normalization, app-host detection including Vercel preview subdomains, verified-only Organization resolution) wired into `src/proxy.ts` (renamed from `middleware.ts` — Next.js 16 deprecated that file convention; `npx @next/codemod middleware-to-proxy` did the rename). Scoped to `/public/*` only via `config.matcher`, so it cannot affect workspace/auth/API routes.
- **RED/GREEN:** `organization-resolution.test.ts` — 10 tests, including "one Organization's domain never resolves to a different Organization's row" and "unverified domain → null, never a fallback."
- **Explicitly not done (by the user's earlier choice, not an oversight):** no real Vercel Domains API registration, no real DNS verification. `use-public-org.ts`'s dev-only Organization switcher is still what the public site's own pages read — `x-beacon-organization-id` (the header `proxy.ts` sets) is not yet consumed anywhere, since swapping that over blind (without a real domain to test against) risked destabilizing the one Organization-context mechanism that currently works.

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | `getSupabaseUrl`/`AnonKey`/`ServiceRoleKey` throw a descriptive error when unset | `src/lib/supabase/env.test.ts` | unit | PASS |
| 2 | Every DB row shape maps correctly to its camelCase entity | `src/lib/supabase/mappers.test.ts` | unit | PASS (8) |
| 3 | Async collection store: load-once-per-key, cross-scope merge-by-id, invalidate, retry-after-failure | `src/lib/supabase/collection-store.test.ts` | unit | PASS (6) |
| 4 | `useSession` maps Supabase Auth errors correctly; loads the `profiles` row | `src/hooks/use-session.test.ts` | unit | PASS (6) |
| 5 | Org domain add/remove hit Supabase; duplicate-domain (23505) → friendly error | `src/hooks/use-organizations.test.ts` | unit | PASS (4) |
| 6 | Space creation bootstraps its own admin permission row; role upsert; invite insert | `src/hooks/use-spaces.test.ts` | unit | PASS (3) |
| 7 | Page CRUD, reorder, and atomic publish/update/unpublish via RPC | `src/hooks/use-pages.test.ts` | unit | PASS (7) |
| 8 | Version create/restore (restore never destructive) | `src/hooks/use-versions.test.ts` | unit | PASS (2) |
| 9 | User list loads from `profiles`, scoped by organizationId | `src/hooks/use-users.test.ts` | unit | PASS (2) |
| 10 | Offline autosave buffer round-trips via IndexedDB | `src/lib/offline-buffer.test.ts` | unit | PASS (5) |
| 11 | Autosave persists on failure, clears on success, flushes on mount/reconnect | `src/hooks/use-page-autosave.test.ts` | unit | PASS (3) |
| 12 | Screenshot block CRUD + full upload orchestration (presign → S3 → DB) | `src/hooks/use-screenshot-blocks.test.ts` | unit | PASS (4) |
| 13 | Presigned-upload object key generation and S3 POST policy conditions | `src/lib/s3/presign.test.ts` | unit | PASS (5) |
| 14 | Screenshot object key → displayable URL resolution | `src/lib/s3/screenshot-url.test.ts` | unit | PASS (3) |
| 15 | Public TOC/page queries scoped by Organization, never a cross-org fallback | `src/hooks/use-public-content.test.ts` | unit | PASS (4) |
| 16 | Internal/public full-text search, org-scoped | `src/hooks/use-search.test.ts` | unit | PASS (5) |
| 17 | Host → Organization resolution: verified-only, no cross-domain leakage | `src/lib/organization-resolution.test.ts` | unit | PASS (10) |
| — | Full test suite | (all above) | unit | **81/81 PASS** |
| — | Project typecheck | `npx tsc --noEmit` | static | PASS, 0 errors |
| — | Production build (placeholder env vars — no real credentials) | `npm run build` | build | PASS, all routes compile |
| — | RLS policies (anon read=0, viewer write=0 rows, owner-only domain update, bootstrap permission) | `supabase/tests/database/rls_policies.test.sql` | pgTAP | **NOT RUN** — no reachable Postgres this session |

## Coverage and known gaps

`npx vitest run --coverage` (v8, thresholds set to 80% in `vitest.config.mts`) against the files actually exercised by tests:

```
Statements   : 65.71% ( 462/703 )
Branches     : 49.72% ( 181/364 )
Functions    : 64.08% ( 157/245 )
Lines        : 72.04% ( 415/576 )
ERROR: Coverage for lines/functions/statements/branches does not meet the 80% global threshold
```

This does **not** meet the skill's 80% bar. Being direct about where: I wrote focused tests for the trickiest logic in each hook (create/mutate paths, error handling, RLS-mirroring filters) rather than exhaustive tests for every thin read-selector (e.g. `useSpace`, `useSpacePermissions`, `useUserSpaces`, `useChildPages` have real implementations but only get indirect coverage through other tests, not their own). Lowest-covered files: `use-spaces.ts` (32% lines), `use-pages.ts` (54% lines), `use-organizations.ts` (64% lines), `use-versions.ts` (63% lines). If closing this gap matters before this is trusted as "Stage 2 done," it needs another pass adding direct tests for those selector hooks — I did not do that here in favor of covering all seven epics' core write/mutation paths within this session.

Other known gaps, in order of how much they matter:

1. **Nothing has run against a real Postgres/Supabase instance.** Migrations, RLS policies, and the pgTAP suite are syntax-checked only. This is the load-bearing gap — until someone runs `supabase db push` (or `db reset`) and `supabase test db` against a real instance, none of the RLS guarantees in Epic 9 are actually confirmed, only argued-for in code review.
2. **MinIO/S3 has never received a real upload.** `docker-compose.yml` and the presign flow are new and unexercised against a live bucket.
3. **Epic 14a stops short of live domain routing**, by the explicit choice made earlier in this session (no Vercel account available). The resolution logic is real and tested; the public site doesn't consume it yet.
4. **`src/lib/data-store.ts` (the Stage 1 mock store) still exists** and is still imported by `use-comments.ts` and `use-feedback.ts` — those are Stage 3 (Epics 15/16), out of this session's scope, so they were deliberately left on mock data rather than converted.
5. **Coverage gap** noted above.

## Session 2 — Real Infrastructure Verification

**What changed since the report above:** Docker, a running MinIO container, and a live (already-migrated) remote Supabase Postgres instance became available. This session re-ran what was previously only reasoned about, against the real thing, instead of adding new mocked tests.

### Re-ran full unit suite
- **Command:** `npx vitest run --coverage`
- **Result:** 81/81 tests passing (unchanged). Coverage: statements 65.66%, branches 49.72%, functions 64.08%, lines 72% — still below the 80% global threshold, same gap as the original report; not addressed this session (out of scope for infra verification).

### Real bug caught by live testing (not by any test): browser env-var inlining
`src/lib/supabase/env.ts`'s `requireEnv(name)` did `process.env[name]` — a dynamic, computed property access. Next.js/Turbopack can only statically inline `NEXT_PUBLIC_*` vars into the browser bundle when the access is a literal `process.env.NEXT_PUBLIC_X`; a dynamic lookup can't be analyzed, so nothing gets inlined and the browser build throws `Missing required environment variable` on every page using `useSession`, regardless of `.env.local` contents. This is a bug **unit tests could never have caught**, since Vitest runs in Node where a real `process.env` object exists — only running the actual `next dev` build in a real browser surfaced it. **Fixed** by passing the literal `process.env.NEXT_PUBLIC_X` value into `requireEnv` at each call site instead of doing the lookup inside the shared helper (`src/lib/supabase/env.ts`).

### Real infra bug caught: missing table grants on manually-run migrations
The migrations never contain `GRANT` statements — they rely on Supabase's platform automatically granting `anon`/`authenticated`/`service_role` privileges on every `public` schema table, which normally only happens via `supabase db push`/the Dashboard. Since this project's migrations were applied via a direct SQL connection instead, that automatic grant step never ran: real login failed with `permission denied for table profiles` (Postgres 42501) the moment `useSession` tried to read the signed-in user's `profiles` row — RLS was never even reached, the table-level grant blocked it first. Fixed by running the standard Supabase default-privilege `GRANT`/`ALTER DEFAULT PRIVILEGES` statements directly against the remote DB.

### Real S3/MinIO upload — Epic 12's biggest gap, now closed
Previously: *"MinIO/S3 has never received a real upload... never started — no Docker this session."*
This session: started MinIO via `docker compose up -d --wait minio-init` (bucket `beacon-screenshots` created, anonymous-download policy applied), then a real screenshot was uploaded through the app's actual UI (presign → direct browser-to-S3 POST → DB insert) while authenticated as a real user.
- **Verified via `mc ls` against the live container:** `screenshots/4994b434-d2a4-4911-89a1-dd6ffac0a76e/f1793cc5-0d78-4a87-a4d2-4c99a531cf96.png` (628 KiB) actually exists in the bucket.
- **Verified public readability:** `curl -o /dev/null -w '%{http_code}'` against `http://localhost:9000/beacon-screenshots/<key>` → `200 image/png`, matching the exact URL shape the app builds from `NEXT_PUBLIC_S3_PUBLIC_URL_BASE`.
- **What is now guaranteed for real (not mocked):** the full presign → upload → publicly-readable-URL round trip works end-to-end against a real S3-compatible store.

### Real RLS spot-check against the live database (partial substitute for pgTAP, which remains not run — see below)
Queried the live REST endpoint with the real anon key (`.env.local`'s `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and **no session** — genuinely unauthenticated:

| Table | Anon query | Result | Matches AC? |
|---|---|---|---|
| `pages` | `GET /rest/v1/pages?select=id,title` | `[]` | Yes — internal pages invisible to anon |
| `profiles` | `GET /rest/v1/profiles?select=id,email` | `[]` | Yes — profiles are internal-only |
| `spaces` | `GET /rest/v1/spaces?select=id,name` | `[{"id":"27a47b64-...","name":"Cakra-Academic"}]` | Yes — `spaces_select_public_publishable` intentionally exposes `is_publishable=true` Spaces to anon (Flow 5's public TOC); this Space had been marked publishable |

This is real evidence — against the actual live database, actual RLS policies as applied, actual `GRANT`s as fixed above — that Epic 9's table-level access control holds for the three tables spot-checked.

**pgTAP suite (`supabase/tests/database/rls_policies.test.sql`) — still NOT run.** `supabase projects list` (CLI is authenticated) does not show this project (`jrdtpmtpjowouknmuxid`) under the linked account, so `supabase link`/`supabase test db` wasn't available without further account/access setup this session didn't chase down given time/cost constraints. The REST spot-check above is real but narrower than the full pgTAP suite (e.g., it doesn't check the bootstrap-permission-insert AC or the non-owner-domain-update-affects-0-rows AC).

### Updated known gaps
1. ~~Nothing has run against a real Postgres/Supabase instance~~ → **partially closed**: real anon-vs-authenticated RLS behavior spot-checked live (table above); full pgTAP suite still not executed.
2. ~~MinIO/S3 has never received a real upload~~ → **closed**: real upload verified end-to-end.
3. Epic 14a live domain routing — still deferred, unchanged.
4. `src/lib/data-store.ts` mock store still used by Stage 3 hooks — unchanged, out of scope.
5. Coverage gap (65.66%/49.72%/64.08%/72% vs 80% target) — unchanged, not addressed this session.
6. **New:** multi-organization cross-tenant isolation (a second real Organization/user) was not tested live — only single-tenant anon-vs-authenticated was spot-checked.

## Merge evidence

No squashing planned — this session made 9 checkpoint commits (one per epic plus the test-infra setup and the `proxy.ts` rename), each with the RED/GREEN evidence and any bugs caught inlined in the commit message. If these get squashed later, the "Task report" section above is the summary to carry forward.
