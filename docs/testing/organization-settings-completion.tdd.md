# TDD Evidence Report — Organization Settings Completion

**Source plan:** none (`*.plan.md` artifact) — this was prerequisite work identified during `/ecc:plan`'s codebase exploration for the "documentation publishing" feature, then executed per user instruction ("implement organization settings first") using `/ecc:tdd-workflow`.

## Context

Organization Settings (Epic 8a/9 in this repo's `PRD.md`) turned out to already be substantially built: domain add/remove UI, an owner-only RLS policy, a Postgres unique-domain constraint, and a real Host-header→Organization middleware (`src/proxy.ts`). Two concrete gaps were found and closed across two sessions:

1. **`verifyDomain` was a client-side coin flip** (`Math.random() < 0.6`), not a real DNS check — fixed in the prior session (`src/lib/dns/verify-domain.ts`, `/api/organizations/[id]/verify-domain`, rate-limit migration). Not re-covered by this report.
2. **The middleware's resolved Organization was never consumed.** `src/proxy.ts` sets `x-beacon-organization-id` on a verified custom-domain request, but the public site read its Organization exclusively from a dev-only `localStorage` switcher (`use-public-org.ts`). The two were completely disconnected — this report covers closing that gap.

## User Journeys

1. As a Viewer on a verified custom domain (e.g. `docs.dibimbing.id`), I see that Organization's content resolved from the real Host header — not a developer's local browser state — so multi-domain routing actually functions once deployed.
2. As a Viewer on a real custom domain, I never see any hint that other Organizations exist (no switcher, no leaked list) — PRD.md Flow 5's explicit isolation requirement.
3. As a developer running locally (no real custom domain reaches the app), I can still preview any Organization's public site via the existing dev switcher — the fix must not break local development.

## Task Report

### Task 1 — `resolvePublicOrganizationId` precedence rule
- **Summary:** Added a pure function encoding "header always wins over the dev switcher, never blended" in `src/lib/organization-resolution.ts` (the existing home for Host→Organization resolution logic).
- **RED:** `npx vitest run src/lib/organization-resolution.test.ts` — 4 of 5 new cases failed with `TypeError: resolvePublicOrganizationId is not a function` (5th failure cascaded from the same missing export). Confirmed failing for the intended reason (function didn't exist), not a setup error.
- **GREEN:** Same command after implementation — `PASS (15) FAIL (0)`.
- **Guarantees:** header id wins even when a conflicting dev-switcher id is present; empty-string header treated as absent; null+null → null.

### Task 2 — `usePublicOrgContext` header wiring + isolation
- **Summary:** Added `PublicOrgHeaderContext` (`src/hooks/public-org-header-context.ts`) and updated `usePublicOrgContext` to consume it, short-circuiting to a single-Organization result (never the full list) whenever a header id is present.
- **RED:** `npx vitest run src/hooks/use-public-org.test.tsx` — collection failure: `Failed to resolve import "./public-org-header-context"` (module didn't exist yet). Confirmed RED for the intended reason.
- **GREEN:** Same command after implementation — `PASS (5) FAIL (0)`.
- **Guarantees:** header-resolved Organization returned when present; `organizations` array collapses to `[organization]` (never leaks siblings) once a header is active; header overrides a conflicting localStorage value; localStorage fallback still works with no header; an unmatched header id returns `null`/`[]`, never a fallback Organization.

### Task 3 — Server Component wiring (`(public)/layout.tsx`)
- **Summary:** Split the layout into a Server Component (`layout.tsx`, reads `x-beacon-organization-id` via `next/headers`, renders `PublicOrgHeaderContext.Provider`) and a client shell (`public-layout-client.tsx`, unchanged nav/TOC/switcher UI). This is the piece that actually connects `proxy.ts`'s resolved header to the two hook-level guarantees above — not independently unit-tested (thin plumbing; no prior test existed for the old layout either), verified instead via typecheck, lint, and the full suite.
- **Validation:** `npx tsc --noEmit --pretty false` → `No errors found`. `npx eslint` on the four touched files → `No issues found`. Full suite → `PASS (217) FAIL (0)` (207 pre-existing + 10 new).

## Test Specification

| # | What is guaranteed | Test file | Type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | Header Organization id wins over the dev-switcher id when both are present | `src/lib/organization-resolution.test.ts` | unit | PASS | `resolvePublicOrganizationId` describe block |
| 2 | Empty-string header treated as absent, falls back to dev switcher | `src/lib/organization-resolution.test.ts` | unit | PASS | same |
| 3 | No header + no dev selection → `null` | `src/lib/organization-resolution.test.ts` | unit | PASS | same |
| 4 | `usePublicOrgContext` resolves the header-matched Organization | `src/hooks/use-public-org.test.tsx` | unit | PASS | first `it` |
| 5 | A header-resolved Organization never exposes that other Organizations exist | `src/hooks/use-public-org.test.tsx` | unit | PASS | "never reveals..." `it` |
| 6 | Header overrides a conflicting localStorage dev-switcher value | `src/hooks/use-public-org.test.tsx` | unit | PASS | "ignores a dev-switcher..." `it` |
| 7 | No header → dev-switcher fallback still works, full org list still shown | `src/hooks/use-public-org.test.tsx` | unit | PASS | "falls back..." `it` |
| 8 | Unmatched header id → `null`/`[]`, never a fallback Organization | `src/hooks/use-public-org.test.tsx` | unit | PASS | last `it` |

## Coverage and Known Gaps

- Full suite: `217/217` passing (`npx vitest run`). `npx vitest run --coverage` completed with exit code 0 against this project's enforced 80% global thresholds (lines/functions/branches/statements, `vitest.config.mts`); the project's coverage config only emits `text`/`html` reporters (no `json-summary`), so an exact per-file percentage for the new files couldn't be extracted programmatically in this session — reporting the threshold-enforced pass/fail signal rather than fabricating a number.
- All branches of the two new units (`resolvePublicOrganizationId`, `usePublicOrgContext`'s header path) are exercised by dedicated test cases by construction (header present/absent/empty/unmatched, conflicting vs. absent dev-switcher value).
- `(public)/layout.tsx` and `public-layout-client.tsx` are integration plumbing, validated via typecheck/lint/full-suite rather than a dedicated unit test — consistent with this codebase's existing convention of not unit-testing layout shells.
- Out of scope for this cycle (belongs to the larger documentation-publishing plan, not yet confirmed): platform-domain fallback for Organizations without a custom domain, page/Organization slugs, the richer `pending/verifying/active/failed` domain status model, and real Vercel Domains API / SSL provisioning (no Vercel credentials available in this environment).

## Merge Evidence

Git checkpoints on `development` (chronological):
1. `test: add reproducer for public-site header-vs-dev-switcher Organization resolution` — RED
2. `fix: add resolvePublicOrganizationId — header takes precedence over dev switcher` — GREEN
3. `test: add reproducer for usePublicOrgContext header-vs-dev-switcher wiring` — RED
4. `fix: wire the real Host-header Organization into usePublicOrgContext` — GREEN
5. `refactor: split (public) layout into a Server Component + client shell` — integration wiring, full suite green
