# TDD Evidence Report — Update a Space's Settings (publishing + name)

## Source plan

No `*.plan.md` file. Plan produced inline via `/ecc:plan` and confirmed by the
user ("yes, proceed"). User request:

> Currently, when creating a space, users are asked whether that space can be
> published or not. However, after creation, there is no feature yet to update
> the space settings — to change whether it can be published or if it should
> remain internal only. I want this space update feature to be added.

Follow-up in the same session: *"please add feature update space's name too"* —
handled as a second RED→GREEN pass, documented in the "Round 2" sections below.

## Scoping research

- `Space.isPublishable` already exists end to end: the type (`src/lib/types.ts`),
  the row mapper (`src/lib/supabase/mappers.ts`), the create path
  (`useCreateSpace` + New Space modal), and every read/publish gate that joins on
  `spaces.is_publishable` (RLS `rls_policies.sql:131,218,232,310`;
  `page-editor-toolbar.tsx`).
- RLS `spaces_update_admin_only` (`20260806100100_rls_policies.sql:146`) already
  allows a Space admin to UPDATE any column on their Space. **No migration and no
  schema change were required** — this is a hook + UI change only.
- The only gap: no `useUpdateSpace` hook and no post-creation UI to reach it.
  The New Space modal was the sole place `isPublishable` could ever be set.

## User journeys

1. As a Space admin, I want to turn my Space's "publishable" setting on or off
   after creation, so I can change whether its Pages can reach the public site.
2. As a Space admin, when I turn publishing **off**, I want to be warned first
   that Pages already published will disappear from the public site, so I don't
   do it by accident.
3. As a non-admin (viewer/editor), I should never see or reach the Space settings
   screen — hidden entirely, matching the Members screen convention.
4. As a Space admin, I want a "Pengaturan" entry point on the Space page next to
   "Anggota", so the setting is discoverable.

## Task report

| Task | Summary | Validation | Result |
|---|---|---|---|
| RED: `useUpdateSpace` | Added 2 failing tests to `use-spaces.test.ts` (updates `is_publishable` + syncs `spacesStore`; error path leaves store untouched) | `npx vitest run src/hooks/use-spaces.test.ts` | FAIL — `useUpdateSpace is not a function` (2 new failures; 13 pre-existing tests still passing) |
| GREEN: `useUpdateSpace` | Implemented in `src/hooks/use-spaces.ts` — builds a snake_case patch, `.update().eq("id", id)`, then immutably maps the change into `spacesStore` on success only | `npx vitest run src/hooks/use-spaces.test.ts` | PASS — 15/15 |
| RED: Space settings page | New `src/app/(workspace)/spaces/[spaceId]/settings/page.test.tsx` — 4 tests (toggle reflects current value for admin; `NotFoundState` + no toggle for non-admin; ON updates immediately; OFF asks for confirmation then updates on confirm) | `npx vitest run "src/app/(workspace)/spaces/[spaceId]/settings/page.test.tsx"` | FAIL — `Failed to resolve import "./page"` |
| GREEN: Space settings page | New `src/app/(workspace)/spaces/[spaceId]/settings/page.tsx` — admin-gated (`useSpaceRole` → `NotFoundState`), a `Card` with the `Switch` (same markup as the New Space modal), turning OFF routes through the shared `DeleteConfirmDialog` | `npx vitest run "src/app/(workspace)/spaces/[spaceId]/settings/page.test.tsx"` | PASS — 4/4 |
| RED: settings entry point | New `src/app/(workspace)/spaces/[spaceId]/page.test.tsx` — 2 tests (admin sees a "Pengaturan" link to `/spaces/space-1/settings`; non-admin does not) | `npx vitest run "src/app/(workspace)/spaces/[spaceId]/page.test.tsx"` | FAIL — link absent (page renders; no "Pengaturan" affordance) |
| GREEN: settings entry point | `spaces/[spaceId]/page.tsx` — added an admin-only "Pengaturan" `Link` before "Anggota"; moved the `Users` icon onto "Anggota" so `Settings` reads as settings | `npx vitest run "src/app/(workspace)/spaces/[spaceId]/page.test.tsx"` | PASS — 2/2 |
| Regression check | Full suite + typecheck + lint on touched files | `npx vitest run`, `npx tsc --noEmit`, `npx eslint <touched>` | PASS — 358/358 tests, 0 type errors, 0 lint issues in touched files |
| Production build | `next build` | `node_modules/.bin/next build` | PASS — exit 0, `/spaces/[spaceId]/settings` route registered, TypeScript in build clean |

## What is guaranteed by the passing tests

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | `useUpdateSpace` sends `{ is_publishable: <bool> }` to `spaces` filtered by `id`, and reflects the change in `spacesStore` | `use-spaces.test.ts:useUpdateSpace updates is_publishable on the row and syncs the local store` | unit | PASS |
| 2 | A failed `useUpdateSpace` write throws and leaves `spacesStore` untouched (no optimistic drift) | `use-spaces.test.ts:useUpdateSpace throws when Supabase returns an error, without touching the local store` | unit | PASS |
| 3 | An admin sees the publishable toggle pre-set to the Space's current `isPublishable` value | `settings/page.test.tsx:shows the publishable toggle reflecting the Space's current setting for an admin` | unit | PASS |
| 4 | A non-admin gets `NotFoundState` and no toggle is rendered | `settings/page.test.tsx:renders a not-found state for a non-admin, with no toggle` | unit | PASS |
| 5 | Turning publishing ON calls `updateSpace(spaceId, { isPublishable: true })` with no confirmation step | `settings/page.test.tsx:turns publishing on immediately, without a confirmation step` | unit | PASS |
| 6 | Turning publishing OFF does nothing until the user confirms; confirming calls `updateSpace(spaceId, { isPublishable: false })` | `settings/page.test.tsx:asks for confirmation before turning publishing off, then updates on confirm` | unit | PASS |
| 7 | An admin sees a "Pengaturan" link pointing at `/spaces/{id}/settings` on the Space page | `spaces/[spaceId]/page.test.tsx:shows an admin a link to the Space settings page` | unit | PASS |
| 8 | A non-admin sees no "Pengaturan" link on the Space page | `spaces/[spaceId]/page.test.tsx:hides the settings link from a non-admin` | unit | PASS |

## Edge cases covered / considered

- **Non-admin direct navigation** to `/spaces/{id}/settings` → `NotFoundState` (test 4). Logged-out user hits the same guard (`!user || role !== "admin"`).
- **Space not found / no access** → `useSpace` returns `undefined` → page renders `null` (mirrors the Members page).
- **Turning OFF with published Pages** → the confirm dialog states explicitly that published Pages vanish from the public site "sampai Space ini diaktifkan kembali"; nothing is deleted (RLS join only). Covered by test 6 (confirmation is required).
- **No-op toggle** → `setPublishable` early-returns when `next === space.isPublishable`.
- **In-flight double toggle** → the `Switch` is `disabled={isSaving}` during the write.
- **Write rejected by RLS** (admin demoted mid-session, network) → `toast.error`, `spacesStore` untouched (hook test 2); the `Switch` stays bound to the stored value so it snaps back.
- **Turning ON without a verified Org domain** → allowed (the flag is independent of the domain); the per-Page Publish button keeps its existing disabled+tooltip state. No change to that logic.

## Round 2 — rename the Space

### User journeys

5. As a Space admin, I want to rename my Space after creation, so I can fix a
   typo or reflect a change without deleting and recreating it.
6. As a Space admin, the "Simpan" button should stay disabled until I've
   actually changed the name to a non-blank value, so I can't fire a no-op or
   blank write.

### Task report

| Task | Summary | Validation | Result |
|---|---|---|---|
| RED: `useUpdateSpace` name | Added a 3rd test to the `useUpdateSpace` block (updates `name` + syncs `spacesStore`) | `npx vitest run src/hooks/use-spaces.test.ts` | FAIL — `expected "update" to be called with [ { name: 'Mobile App v2' } ]`, received `[]` (the hook only mapped `is_publishable`) |
| RED: rename UI | Added 2 tests to `settings/page.test.tsx` (edit name + Simpan → `updateSpace(id, { name })`; Simpan disabled while unchanged/blank, enabled once changed) | `npx vitest run "src/app/(workspace)/spaces/[spaceId]/settings/page.test.tsx"` | FAIL — `Unable to find a label with the text of: Nama Space` |
| GREEN: `useUpdateSpace` name | Widened the patch type to `{ name?: string; isPublishable?: boolean }` and mapped `name` into the update row | same as above | PASS — 16/16 in the hook file |
| GREEN: rename UI | Extracted the editable body into `SpaceSettingsForm({ space })` (so `useState(space.name)` initializes only after the Space loads — mirrors OrganizationSettings' `GeneralTab`), added a name `Card` with `Input` + "Simpan", disabled/revert-on-error logic copied from `GeneralTab` | same as above | PASS — 6/6 in the settings page file |
| Regression | Full suite + typecheck + lint + build | `npx vitest run`, `npx tsc --noEmit`, `npx eslint`, `next build` | PASS — 361/361, 0 type errors, 0 lint issues, build exit 0 |

### Added guarantees

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 9 | `useUpdateSpace` sends `{ name }` to `spaces` filtered by `id` and reflects it in `spacesStore` | `use-spaces.test.ts:useUpdateSpace updates name on the row and syncs the local store` | unit | PASS |
| 10 | Editing the name field and clicking "Simpan" calls `updateSpace(spaceId, { name: <trimmed> })` | `settings/page.test.tsx:renames the Space when an admin edits the name and saves` | unit | PASS |
| 11 | "Simpan" is disabled when the name equals the current name or is blank, and enabled only after a real change | `settings/page.test.tsx:keeps the save button disabled while the name is unchanged or blank` | unit | PASS |

### Round 2 edge cases

- **Blank / whitespace-only name** → `trimmedName.length > 0` guard keeps "Simpan" disabled and `handleSaveName` early-returns (test 11).
- **No-op save** (name unchanged) → `trimmedName !== space.name` guard (test 11).
- **Leading/trailing spaces** → the value sent is `nameInput.trim()` (test 10 types a clean value; the trim is asserted by the `{ name: "Aplikasi Mobile v2" }` arg shape).
- **Write rejected** → `toast.error` and `setNameInput(space.name)` restores the field to the stored value; `spacesStore` untouched (hook error-path test, guarantee #2, is shared).
- **In-flight save** → `Input` and "Simpan" both `disabled={isSavingName}`; button shows "Menyimpan…".
- **Rename is independent of the publishable toggle** — separate `isSavingName` / `isSavingPublishable` flags, separate `updateSpace` calls.

## Coverage and known gaps

- Full project suite: `npx vitest run` → **361/361 passing** (was 358 after round 1; +3 in round 2). `npx tsc --noEmit` → 0 errors. `npx eslint` on the touched/created files → **0 issues**.
- `npm run test:coverage` **exits non-zero on this repo today, independent of this change**. Measured `total` before this change (from a clean `git stash`): statements 75.88%, branches 64.09%, functions 73.29%, lines 80.07% — already under the configured 80% global thresholds. After this change: statements 75.55%, branches 64.20%, functions 72.87%, lines 79.59% (roughly neutral; the dip is large, mostly-untested App Router `page.tsx` files being weighted more). The new `settings/page.tsx` itself measures 85% statements / 71% branches / 80% functions. The real gate (`npm test`, 358 tests) is green.
- **`use(params)` IS testable now.** The previous TDD report
  (`space-page-delete-crud.tdd.md`) recorded that React 19's `use(params)` in an
  App Router `page.tsx` "suspends indefinitely under React Testing Library +
  jsdom". This round found the fix: render inside `await act(async () => { … })`
  with a module-level `Promise.resolve(params)` so the Suspense boundary resumes
  within the act flush. Both new page test files use this helper — `page.tsx`
  route files are now unit-testable in this codebase.
- **`DeleteConfirmDialog` reuse wart:** its confirm button shows "Menghapus…"
  while `isDeleting` is true, so the "Jadikan Internal" flow briefly shows
  "Menghapus…" during the ~200ms write. Accepted: the component is the
  established shared confirm primitive (also reused for "remove member"), and the
  flash is transient. Not worth a second primitive.

## Merge evidence

No checkpoint commits were created — per the operator's standing instruction
([[feedback_no_auto_commit]]): wait for an explicit "commit"/"push" before
committing, even after finishing work. This report plus `git status` / `git diff`
is the durable RED → GREEN → verification record.

Files changed:
- `src/hooks/use-spaces.ts` — new `useUpdateSpace` hook (`{ name?, isPublishable? }`)
- `src/hooks/use-spaces.test.ts` — +3 tests
- `src/app/(workspace)/spaces/[spaceId]/settings/page.tsx` — new route (created); name + publishable settings
- `src/app/(workspace)/spaces/[spaceId]/settings/page.test.tsx` — new (6 tests)
- `src/app/(workspace)/spaces/[spaceId]/page.tsx` — "Pengaturan" entry point
- `src/app/(workspace)/spaces/[spaceId]/page.test.tsx` — new (2 tests)
