# TDD Evidence Report — Platform-Domain Publishing

**Source plan:** inline `/ecc:plan` output (conversational mode, no `*.prd.md`/`*.plan.md` artifact) — user reprioritized from "custom domain first" to "platform domain first: any published Space/Page must be viewable by anonymous Viewers under Beacon's own domain, no custom-domain setup required." Confirmed with "proceed with this plan," then implemented via `/ecc:tdd-workflow`.

**Builds on:** [organization-settings-completion.tdd.md](./organization-settings-completion.tdd.md) (prior session) — the `PublicOrgHeaderContext` / `usePublicOrgContext` header-precedence work from that report is extended here, not redone.

## Key finding that shaped the plan

Publishing was hard-blocked unless the Organization had a *verified custom domain* (`page-editor-toolbar.tsx` disabled Publish whenever `!organization.isDomainVerified`), and the only public route resolved its Organization exclusively from that verified domain (or, in dev, a localStorage switcher). `org-cakrawala` (no custom domain, per seed fixtures) could not publish anything at all. Removing that gate and giving every Organization an always-available platform-domain identity was the actual unblocking work — not new UI.

## User Journeys

1. As a Space admin/editor in any Organization (verified custom domain or not), I can publish a Page and it becomes viewable by anonymous Viewers under the platform's own domain.
2. As a Viewer, I can browse an Organization's published content at `/public/{orgSlug}` and `/public/{orgSlug}/pages/{pageSlug}` — readable, stable URLs, not raw UUIDs.
3. As a Viewer on a real custom domain, nothing regresses — the existing header-resolved tree (`/public`, `/public/pages/{pageSlug}`) keeps working exactly as before.
4. Public search and navigation links are correct in both trees — clicking a result or a TOC entry never lands on a 404 or the wrong Organization's content.

## Scope decision (communicated, not silently cut)

Section 3.1 of the original feature brief asked for *owner-editable* slugs. This pass ships **auto-generated slugs** (Organization slug from name, Page slug from title at publish time, collision-safe) rather than a manual slug-editing UI, to keep the "make it viewable" priority tight. Flagged explicitly, not swept under a generic "done."

## Task Report

### Task 1 — Org/Page slug schema
- **Summary:** `organizations.slug` (BEFORE INSERT trigger + backfill, unique) and `pages.organization_id`/`pages.slug` (denormalized trigger, assigned by `publish_page()` at first publish, unique per Organization) — migration `20260813010000_organization_page_slugs.sql`. `src/lib/slug.ts` provides `slugify`/`validateSlug` (format + reserved-route-word list) shared conceptually with the Postgres `slugify()` function (hand-kept in sync, documented as such).
- **RED → GREEN:** `npx vitest run src/lib/slug.test.ts` — RED (module didn't exist) → GREEN `PASS (14) FAIL (0)`.
- **Note:** migrations could not be applied against a live Postgres instance in this environment (no local Supabase stack running — `supabase status` reports no container). Verified by careful review + mirroring the exact style of existing migrations (`20260807000000_feedback_rate_limit.sql`'s backfill-loop pattern), not by execution.

### Task 2 — Remove the domain-verification publish gate
- **Summary:** `page-editor-toolbar.tsx`'s `disabledReason` now depends only on `space.isPublishable`. Also fixed the publish-success "Lihat halaman publik" link, which previously built `/public/pages/{uuid}` from a potentially-stale prop — now builds `/public/{orgSlug}/pages/{pageSlug}` from the freshly-published Page's RPC result.
- **RED → GREEN:** `npx vitest run src/components/editor/page-editor-toolbar.test.tsx` — RED (`PASS (12) FAIL (1)`, button disabled when it shouldn't be) → GREEN `PASS (14) FAIL (0)` after the gate removal; a second RED→GREEN pair covered the link fix (`PASS (13) FAIL (1)` → `PASS (14) FAIL (0)`).

### Task 3 — Platform-domain public routes
- **Summary:** `usePublicOrgContext` gained a third resolution tier — the URL's `orgSlug` param (`/public/[orgSlug]/*`), resolved client-side against the already-loaded Organizations list, no extra network round-trip — and now exposes `basePath` so every link builder has one source of truth. New routes (`/public/[orgSlug]`, `/public/[orgSlug]/pages/[pageSlug]`) share components with the existing custom-domain routes (`PublicHomeContent`, `PublicPageView`) with zero duplication, since `usePublicOrgContext` transparently resolves the right Organization either way. `usePublicPage` was changed to look up Pages by `(organization_id, slug)` instead of raw `id`, unifying the identifier both trees use. `SearchResult` gained `pageSlug` so public search results link correctly too.
- **RED → GREEN cycles** (each independently confirmed failing-for-the-right-reason before implementation):
  1. `usePublicOrgContext` orgSlug/basePath — `src/hooks/use-public-org.test.tsx`: RED (8 new failures — property/branch didn't exist) → GREEN `PASS (12) FAIL (0)`.
  2. `usePublicPage` slug-based query — `src/hooks/use-public-content.test.ts`: RED (`PASS (3) FAIL (1)`, still queried by `id`) → GREEN `PASS (4) FAIL (0)`.
  3. `SearchResult.pageSlug` — `src/hooks/use-search.test.ts`: RED (`PASS (4) FAIL (1)`, field missing) → GREEN `PASS (5) FAIL (0)`.
- **Integration wiring** (not independently unit-tested — thin JSX/route-plumbing, consistent with this codebase's existing convention of not unit-testing layout/page shells): the four new/renamed route files, `PublicHomeContent`, `PublicPageView`, and the `basePath` propagation into `PublicToc`, `PublicNav`, `PublicSearchCommand`, and `PageNotAvailable`. Validated via `tsc --noEmit`, `eslint`, and the full suite after each change, plus a project-wide grep (`grep -rn '/public/pages\|href="/public"\|push("/public"\|`/public'`) confirming zero remaining hardcoded `/public` links anywhere in `src/`.

## Test Specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | `slugify` normalizes titles/names (lowercase, diacritics, punctuation, hyphen collapsing, empty-input fallback) | `src/lib/slug.test.ts` | unit | PASS |
| 2 | `validateSlug` rejects bad formats and reserved route words (`pages`, `api`, `public`, `settings`) | `src/lib/slug.test.ts` | unit | PASS |
| 3 | Publish is enabled purely by `space.isPublishable`, regardless of custom-domain verification | `src/components/editor/page-editor-toolbar.test.tsx` | component | PASS |
| 4 | Publish-success link uses the freshly-published Page's slug + Organization slug, not a stale/raw-UUID URL | `src/components/editor/page-editor-toolbar.test.tsx` | component | PASS |
| 5 | `usePublicOrgContext` resolves from `orgSlug` when no header is present | `src/hooks/use-public-org.test.tsx` | unit | PASS |
| 6 | A slug-resolved Organization never exposes that other Organizations exist | `src/hooks/use-public-org.test.tsx` | unit | PASS |
| 7 | Header always wins over `orgSlug` if both are somehow present | `src/hooks/use-public-org.test.tsx` | unit | PASS |
| 8 | `basePath` is `/public/{orgSlug}` or `/public` correctly per resolution tier | `src/hooks/use-public-org.test.tsx` | unit | PASS |
| 9 | `usePublicPage` queries by `(organization_id, slug)`, not bare `id` | `src/hooks/use-public-content.test.ts` | unit | PASS |
| 10 | Public search results carry `pageSlug` for correct link building | `src/hooks/use-search.test.ts` | unit | PASS |

## Coverage and Known Gaps

- Full suite: **241/241 passing** (`npx vitest run`), up from 234 at the start of this task (+7 net new test cases; some existing suites also gained assertions without new `it` blocks).
- `npx tsc --noEmit --pretty false` → clean (one stale-build-cache error from the `[pageId]`→`[pageSlug]` folder rename, resolved by clearing the gitignored `.next/` directory — not a source error).
- `npx eslint .` (project-wide) → 1 error + 2 warnings, all three in files never touched this session (`use-mobile.ts`, `env.test.ts`, a Next.js-generated `block-navigation.js`) — pre-existing, out of scope.
- Migrations are unapplied/unverified against a live database (no local Supabase stack available in this environment) — same constraint noted in the prior evidence report.
- Deferred, explicitly: owner-editable slugs (org and page slugs are auto-generated only), custom-domain CNAME instructions/status machine/polling/SSL provisioning/takeover protection (all now low priority per the reprioritization), SEO metadata (`generateMetadata`/canonical/`og:url`).

## Merge Evidence

Git checkpoints on `development`, chronological, this task (`9ea3af1` through `d7870e7`):

1. `test`/`fix` pair — `organization.slug` + `pages.slug` schema and validation
2. `test`/`fix` pair — remove domain-verification publish gate
3. `test`/`fix` pair — fix stale publish-success link
4. `test`/`fix` pair — `usePublicOrgContext` orgSlug resolution + `basePath`
5. `test`/`fix` pair — `usePublicPage` slug-based query
6. `test`/`fix` pair — `SearchResult.pageSlug`
7. `feat` — platform-domain public routes (integration wiring)
8. `fix` — remaining hardcoded `/public` links (`PublicNav`, `PageNotAvailable`)
