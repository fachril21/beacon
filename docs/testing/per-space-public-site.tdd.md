# TDD Evidence Report — Per-Space Public Site

## Source plan

Inline `/ecc:plan` output, confirmed with "yes, proceed. create the migration
file, i will apply the migration manual on sql editor supabase". Clarifying
questions answered: **directory-home structure**, **new `spaces.slug` column**,
**space-scoped public search**.

> For the publish page feature, I want it to be per space only. Currently, the
> publish page displays all spaces within one organization together. Now I want
> the publish feature to be organized per space. Don't mix it with other spaces.

**Slug-on-rename decision:** the plan offered "slug updates on rename"; shipped
the recommended alternative — **slug is assigned once on create and stays
stable** (matches `organizations.slug` and `pages.slug`; keeps public URLs from
breaking on a rename). `useUpdateSpace` remains name-only.

## User journeys

1. As a public visitor, the Organization's public home is a **directory of its
   publishable Spaces**, not one merged page list.
2. As a visitor, opening a Space shows **only that Space's** published pages and
   a TOC scoped to that Space — never pages from a sibling Space.
3. As a visitor on a published page, the surrounding TOC is still scoped to that
   page's own Space.
4. As a visitor, searching from inside a Space returns **only that Space's**
   pages.
5. As a visitor, an unknown space slug shows a "not available" state — never a
   fallback to another Space (Flow 5).
6. As a Space admin, a Space created before this change already has a working
   public URL (backfilled slug).

## Task report

| Phase / task | Summary | Validation command | Result |
|---|---|---|---|
| 1. Migration | `supabase/migrations/20260817000000_space_slugs.sql` — `spaces.slug` column, `spaces_set_slug()` BEFORE INSERT trigger (per-org dedup), `do $$` backfill `order by created_at`, `set not null`, `unique (organization_id, slug)`. Mirrors `20260813010000_organization_page_slugs.sql`. **Not applied by the agent — user applies it manually via the Supabase SQL editor.** | `node_modules/.bin/next build` (schema not exercised by tests) | Written; pending manual apply |
| 2. RED: `mapSpaceRow` slug | Added `slug` to the `mapSpaceRow` fixture + expectation | `npx vitest run src/lib/supabase/mappers.test.ts` | FAIL — `mapSpaceRow` returned no `slug` |
| 2. GREEN: entity plumbing | `Space.slug: string` (types), `SpaceRow.slug` + mapper, `slug` on the 4 mock fixtures, `slug` on ~9 inline test fixtures (driven out by `tsc`) | `npx tsc --noEmit` → 0 errors; `npx vitest run src/lib src/hooks/use-spaces.test.ts` | PASS — 145/145 in the touched set |
| 3. RED: public data hooks | 6 new tests in `use-public-content.test.ts` for `usePublicSpaces` + `usePublicCurrentSpace` | `npx vitest run src/hooks/use-public-content.test.ts` | FAIL — `usePublicSpaces is not a function`, `usePublicCurrentSpace is not a function` (6 fail, 2 `usePublicPage` still pass) |
| 3. GREEN: hooks | Rewrote `use-public-content.ts`: removed `usePublicToc`, added `usePublicSpaces(orgId)` (directory, spaces with ≥1 published page + count) and `usePublicCurrentSpace(orgId)` (resolves the one Space from `spaceSlug` param, or from `pageSlug` → page → space; null on directory / unknown slug) | `npx vitest run src/hooks/use-public-content.test.ts` | PASS — 8/8 |
| 4. RED: public components | Rewrote `public-home-content.test.tsx` (directory) + `public-toc.test.tsx` (single Space via context); new `public-space-view.test.tsx` | `npx vitest run src/components/public` | FAIL — components still import removed `usePublicToc` |
| 4. GREEN: components + routes | New `PublicSpaceContext` (`src/hooks/public-space-context.tsx`); `PublicHomeContent` → Space directory (cards → `${basePath}/spaces/${slug}`); new `PublicSpaceView`; `PublicToc` → context-driven single Space + "← Semua dokumentasi" back link; `PublicLayoutClient` resolves `usePublicCurrentSpace` once, provides context, renders the TOC rail only inside a Space; new route files `public/spaces/[spaceSlug]/page.tsx` and `public/[orgSlug]/spaces/[spaceSlug]/page.tsx` | `npx vitest run src/components/public` | PASS — 12/12 |
| 5. RED: search scope | 1 new test in `use-search.test.ts` (spaceId narrows results to one Space) | `npx vitest run src/hooks/use-search.test.ts` | FAIL — `["page-1","page-2"]` vs expected `["page-1"]` |
| 5. GREEN: search scope | `usePublicSearch(query, orgId, spaceId?)` — `&& (!spaceId || row.space_id === spaceId)`; `PublicSearchCommand` reads `usePublicSpace()` and forwards `currentSpace?.space.id` | `npx vitest run src/hooks/use-search.test.ts` | PASS — 8/8 |
| 6. Regression | Full suite + typecheck + lint + build | `npx vitest run`, `npx tsc --noEmit`, `npx eslint`, `next build` | PASS — **366/366**, 0 type errors, 0 lint issues on touched files, build exit 0 (both new routes registered) |

## What is guaranteed by the passing tests

| # | Guarantee | Test | Type | Result |
|---|---|---|---|---|
| 1 | `mapSpaceRow` carries `slug` through | `mappers.test.ts:maps a spaces row to the Space shape` | unit | PASS |
| 2 | `usePublicSpaces` returns publishable Spaces with ≥1 published page + a page count | `use-public-content.test.ts:returns publishable Spaces … with a page count` | unit | PASS |
| 3 | `usePublicSpaces` no-queries when orgId is undefined | `use-public-content.test.ts:returns an empty array without querying …` | unit | PASS |
| 4 | `usePublicCurrentSpace` is null + no query on the directory route | `use-public-content.test.ts:returns null without querying on the directory route` | unit | PASS |
| 5 | `usePublicCurrentSpace` resolves by slug → only that Space's page tree, nested | `use-public-content.test.ts:resolves the Space by its slug …` | unit | PASS |
| 6 | On a page route it resolves the Space from the Page's own `space_id` | `use-public-content.test.ts:on a page route resolves the current Space …` | unit | PASS |
| 7 | Unknown slug → null, never a fallback | `use-public-content.test.ts:returns null when the slug matches no publishable Space` | unit | PASS |
| 8 | Home renders one link per Space → `/spaces/{slug}`, no individual page links | `public-home-content.test.tsx:renders one link per publishable Space …` / `… does not render any individual page links` | unit | PASS |
| 9 | `PublicToc` renders nothing on the directory, a back link + only the current Space's pages inside one | `public-toc.test.tsx` (3 tests) | unit | PASS |
| 10 | `PublicSpaceView` shows the Space name + only its pages; "not available" when the slug resolved to nothing | `public-space-view.test.tsx` (2 tests) | unit | PASS |
| 11 | `usePublicSearch` with a `spaceId` returns only that Space's pages | `use-search.test.ts:scopes results to a single Space when a spaceId is given` | unit | PASS |

## Edge cases covered / considered

- **Org with 0 publishable Spaces (or none with published pages)** → directory empty state ("Belum ada panduan yang dipublikasikan") — test #8.
- **Publishable Space with 0 published pages** → excluded from the directory (`publishedPageCount > 0` filter).
- **Unknown `/spaces/[slug]`** → `usePublicCurrentSpace` null → `PublicSpaceView` renders `PageNotAvailable` — tests #7, #10.
- **Page route** → TOC still scoped, resolved via the page's `space_id` — test #6.
- **Directory route** → no TOC rail (synchronous `useParams` check in the layout, so no flash), full-width — test #9 + layout guard.
- **Custom domain vs platform domain** → both get a `spaces/[spaceSlug]` route; `basePath` from `usePublicOrgContext` shapes every link — build shows both routes.
- **Backfill collisions** (two Spaces, same name, one org) → `-2/-3` suffix in both the trigger and the `do $$` backfill.
- **Pre-existing Spaces** → backfilled slug; `useCreateSpace` needs no change (trigger fills slug, `.select()` returns it).
- **Search on a page vs in a Space** → both scoped (page route resolves a current Space too), directory search stays org-wide (`currentSpace` null).

## Known gaps / notes

- **Migration not applied by the agent** — `20260817000000_space_slugs.sql` is written; the user applies it via the Supabase SQL editor. Until applied, `spaces.slug` does not exist and the public site's Space routes will error on the live DB. No automated DB test exercises it (this repo has no pg-tap run wired for ad-hoc migrations).
- **Loading flicker** — `usePublicCurrentSpace` returns `null` both while resolving and when not-found, so `PublicSpaceView` can briefly show "not available" before content on a slow client fetch. This matches the existing `usePublicPage` / `PublicPageView` pattern in this codebase; not changed here.
- **`npm run test:coverage` exits non-zero repo-wide** — pre-existing (measured before this session: ~75% statements / ~64% branches, under the 80% gate, dominated by untested App Router `page.tsx` files). The real gate, `npm test`, is green at 366/366. The new hooks/components carry direct unit tests (11 guarantees above).
- **`PublicHomeContent` behaviour change** — `/public/[orgSlug]` no longer lists pages directly; it lists Spaces. This is the requested change. Individual **page URLs are unchanged** (`/public/[orgSlug]/pages/[slug]`), so existing deep links keep working.
- PRD Flow 5's "TOC sidebar = that Org's publishable Spaces → Pages" now reads per-Space; the no-cross-Org-leak intent is preserved and the no-cross-Space intent is added.

## Merge evidence

No checkpoint commits during the cycle — per the operator's standing instruction
([[feedback_no_auto_commit]]). RED → GREEN sequence is recorded above; `git diff`
plus this report is the durable record.

Files:
- `supabase/migrations/20260817000000_space_slugs.sql` — NEW (manual apply)
- `src/lib/types.ts`, `src/lib/supabase/mappers.ts` — `Space.slug`
- `src/lib/mock/spaces.ts` — fixture slugs
- `src/hooks/use-public-content.ts` — `usePublicSpaces`, `usePublicCurrentSpace`; removed `usePublicToc`
- `src/hooks/public-space-context.tsx` — NEW
- `src/hooks/use-search.ts` — `usePublicSearch` `spaceId` param
- `src/components/public/public-home-content.tsx` — Space directory
- `src/components/public/public-space-view.tsx` — NEW
- `src/components/public/public-toc.tsx` — single-Space, context-driven
- `src/components/public/public-search-command.tsx` — forwards current space id
- `src/app/(public)/public-layout-client.tsx` — resolves + provides current Space
- `src/app/(public)/public/spaces/[spaceSlug]/page.tsx`, `src/app/(public)/public/[orgSlug]/spaces/[spaceSlug]/page.tsx` — NEW routes
- test files: `mappers.test.ts`, `use-public-content.test.ts`, `use-search.test.ts`, `public-home-content.test.tsx`, `public-toc.test.tsx`, `public-space-view.test.tsx` (new), + ~7 fixture-only slug additions
