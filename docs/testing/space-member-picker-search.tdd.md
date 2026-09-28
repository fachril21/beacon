# TDD Evidence: Searchable Space Member Picker

**Source plan**: none — journeys derived during this TDD run from a `/ecc:plan` conversation and live browser testing of the existing UI.

## User journeys

1. As a Space admin with many Organization members, I want to search by name or email when picking who to add to a Space, so I don't have to scroll an unfiltered dropdown.
2. As a Space admin, I want to see when nobody more can be added (everyone already has access), so I don't wonder why the picker looks empty.
3. As a Space admin, I want a clear no-results state when my search matches nobody.
4. As a Space admin, I want to still pick and add a member with a role, exactly as before, just through the new control.

## What changed

`src/app/(workspace)/spaces/[spaceId]/members/page.tsx`: replaced the native `Select`-based member picker (no search, flat scroll list) with a `Popover` + `Command` (cmdk) combobox — same primitives already used for the workspace `⌘K` search palette (`src/components/workspace/search-command.tsx`). Typing filters the list by name+email via cmdk's built-in fuzzy match.

`vitest.setup.ts`: added `ResizeObserver` and `Element.prototype.scrollIntoView` stubs — jsdom has neither, and cmdk requires both. Any future Command-based test needs this global setup, not just this one.

## Task report

| # | Behavior | Validation | Result |
|---|---|---|---|
| 1 | Picker disables and shows "Semua anggota Organisasi sudah memiliki akses." when nobody is addable | `page.test.tsx` — `disables the picker and shows an inline message...` | RED → GREEN |
| 2 | Typing filters visible options by name or email | `page.test.tsx` — `lets an admin search addable Organization members...` | RED → GREEN |
| 3 | A query matching nobody shows "Tidak ditemukan." | `page.test.tsx` — `shows a no-results message...` | RED → GREEN |
| 4 | Picking a member + clicking Tambah still calls `addOrgMemberToSpace` with the right role | `page.test.tsx` — `adds the picked member...` | RED → GREEN |
| 5 | Trigger/option fall back to email when a member has no display name (found via live Chrome testing against the dev DB, not anticipated up front) | `page.test.tsx` — `falls back to the member's email...` | RED → GREEN |

RED evidence (first 4 tests, before the component changed):
```
PASS (0) FAIL (4)
```
GREEN evidence (after implementing the combobox + jsdom stubs):
```
PASS (4) FAIL (0)
```
RED/GREEN evidence for the 5th test (email fallback), found via manual Chrome verification against the running dev app, added after the first four were already green:
```
RED:   TypeError-free but assertion failed — button had no accessible name "budi@corp.id"
GREEN: PASS (5) FAIL (0)
```

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | Trigger is disabled and reads the "everyone already has access" message when `addableMembers` is empty | `page.test.tsx:disables the picker...` | unit | PASS |
| 2 | Typing a name or email substring narrows the visible options; non-matches disappear | `page.test.tsx:lets an admin search...` | unit | PASS |
| 3 | A query with no matches renders "Tidak ditemukan." and no options | `page.test.tsx:shows a no-results message...` | unit | PASS |
| 4 | Selecting an option + clicking "Tambah" calls `addOrgMemberToSpace(spaceId, userId, role)` | `page.test.tsx:adds the picked member...` | unit | PASS |
| 5 | Trigger and option label fall back to email when `name` is an empty string | `page.test.tsx:falls back to the member's email...` | unit | PASS |

Command: `npx vitest run "src/app/(workspace)/spaces/[spaceId]/members/page.test.tsx"` → `PASS (5) FAIL (0)`.

## Coverage and known gaps

Full-suite run after this change: `PASS (400) FAIL (1)`. The one failure (`usePublicSearch scopes results to a single Space...` in `src/hooks/use-search.test.ts`) is a pre-existing flake unrelated to this change — it passes in isolation (`npx vitest run src/hooks/use-search.test.ts` → `PASS (8) FAIL (0)`) and touches unrelated search-scoping logic, not the members page.

Not covered by automated tests (verified manually instead, live against the dev DB and dev server):
- Keyboard navigation (arrow keys / Enter / Escape) inside the popover — exercised visually via Chrome, not asserted in RTL.
- Visual polish (checkmark on the selected option, popover width/positioning) — decorative, not behavior.

`typecheck`/`lint` on touched files: clean (`npx tsc --noEmit`, `npx eslint`).

## Merge evidence

Three checkpoint commits on `development`:
1. `test: add failing reproducer for searchable space member picker` (RED)
2. `fix: replace unsearchable Select with a filterable Command combobox for space member invites` (GREEN)
3. `fix: fall back to email on the member picker when display name is blank` (RED→GREEN for the manually-discovered gap)
