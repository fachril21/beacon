# TDD Evidence Report — Stepper block: nested content support

## Source plan

No `*.plan.md` was provided. This report covers two rounds of work, both continuing from `docs/testing/stepper-block.tdd.md` (the initial Stepper block):

- **Round 1** (this file, original content): the user's request — "the user should be able to add other blocks — even other stepper blocks" inside a step's body — required a breaking architectural change from a JSON-string-prop data model to BlockNote's native block-nesting.
- **Round 2** (this update): a follow-up ticket, modeled on GitBook's stepper (screenshot attached), that re-specified the same requirement in detail (content: "none" + children, full editor affordances inside the step body, export-safety, migration path) plus explicit, checkbox-style acceptance criteria. Round 1's architecture already satisfied nearly all of it; this round verified every criterion against the *running app* rather than assuming, and fixed one real gap found in the process (see below).

## User journeys

Carried over from Round 1, plus:

6. As a Page editor, when I create a new step, I want a ready-to-type body line immediately (matching GitBook's "Step content" placeholder), not an empty void I have to know how to add a block into.
7. As a Page editor, I want the same slash-command menu, drag handle, and block menu inside a step's body that I get at the document root — because it should just *be* a normal nested area, not a restricted one.

## Round 2 task report

| Task | Summary | Validation | Result |
|---|---|---|---|
| Audit current architecture against the new ticket | Re-read `stepper-block.tsx` fresh: confirmed `step` is already `content: "none"` with `children` (not a `description`/`stepsJson` prop) — the ticket's proposed fix was already Round 1's design | Code read | Already correct |
| Check for legacy-format content needing migration | Searched the whole `src/` tree for any reference to the old `stepsJson` prop or mock fixture using `"stepper"` | `Grep` for `stepsJson` and `"stepper"` across `src/` | Zero matches outside the block's own source/tests — no stored content (mock or otherwise) uses the old format; nothing to migrate |
| Check export functions for silent content-dropping | Searched for Markdown/HTML/PDF export code | `Grep` for `exportToMarkdown\|exportToHTML\|blocksToMarkdown\|generatePDF\|pdf-lib\|jspdf` across `src/` | No export functionality exists anywhere in this codebase yet — nothing to fix; flagged as a future consideration |
| RED: seeded empty-body test | Updated `slash-menu-items.test.ts`'s Stepper-insertion test to also assert each seeded step has exactly one child, a `paragraph` | `npx vitest run slash-menu-items.test.ts` | FAIL — steps were seeded with zero children |
| GREEN: seed an empty paragraph per new step | Every place a step gets created (`slash-menu-items.tsx`'s Stepper insert, `stepper-block.tsx`'s "+" insert-after, and the empty-stepper recovery button) now seeds `children: [{ type: "paragraph" }]` | `npx vitest run` (whole project) | PASS — 139/139 |
| Live verification: click into a fresh step's body | Confirmed via `javascript_tool` (checking `window.getSelection().anchorNode`) that clicking the seeded empty line correctly places the cursor inside that step's paragraph | Manual, Chrome automation against a temporary `dev-preview` route (deleted after use) | Cursor lands correctly |
| Live verification: slash menu, list, code block, stacking | Typed `/` inside a step's body → full slash menu opened; inserted a bulleted list (2 items) then, in the same body, a code block right after it | Manual, screenshots taken | Both block types insert correctly; 2 distinct blocks stack vertically in one step's body |
| Live verification: drag handle / block menu inside step body | Hovered a block inside a step's body | Manual, screenshot | The same `+` / `⋮⋮` (drag handle) affordances appear as at the document root — this is BlockNote's own default per-block chrome, not something this feature builds or could disable |
| Reorder-whole-step (drag) | Attempted via the browser-automation tool's `left_click_drag` | Manual | **Inconclusive** — BlockNote's block drag uses the native HTML5 Drag-and-Drop API, which `left_click_drag` (a synthesized mousedown/mousemove/mouseup sequence) does not reliably trigger; the drag attempt closed as a no-op (content unchanged, no data loss). This is a tool limitation, not a verified app defect: step blocks receive the exact same unmodified side-menu/drag-handle wiring as every other block type in this schema, and nothing in the stepper implementation overrides or restricts it. Recommend a manual (real mouse) spot-check before shipping if certainty is required. |
| Regression check | Full project suite + typecheck after all changes | `npx tsc --noEmit`, `npx vitest run` | PASS — 0 type errors, 139/139 tests |

## Answering the ticket's explicit question

> "Please let me know if the `content: 'none'` + children approach is feasible given our current schema, or if this requires a larger refactor... and what a migration path would look like."

It's feasible, and it's already what's implemented (since Round 1, same session). No further refactor was needed. No migration was needed either: this app is in Phase 1a (mock-data stage per PROJECT.md) and a full-codebase search turns up zero stored content — mock fixtures or otherwise — using the pre-Round-1 `stepsJson` prop format. If a real Supabase-backed document is ever found using that old shape, it would render as a `stepper` block with a `stepsJson` prop that the current `stepBlockConfig`/`stepperBlockConfig` don't declare — BlockNote drops unrecognized custom props on load rather than erroring, so worst case is a stepper with no visible steps, not a crash. No such document is known to exist.

## What is guaranteed by the passing tests (Round 2 additions)

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | Inserting "Stepper" from the slash menu seeds each of the two steps with a single empty `paragraph` child | `slash-menu-items.test.ts:inserting Stepper creates a stepper block seeded with two step children, each with an empty paragraph body` | unit | PASS |
| 2 | The "+" insert-after control's underlying call also seeds the new step with an empty paragraph body | `stepper-block.test.tsx:inserts a new step (with an empty paragraph body) immediately after...` (headless) | unit | PASS |
| 3 | The empty-stepper recovery button's underlying call seeds the recovered step with an empty paragraph body | `stepper-block.test.tsx:the empty-stepper recovery button's update also seeds the new step with an empty paragraph body` (headless) | unit | PASS |

(All Round 1 guarantees — numbered steps, nested-stepper-in-step independent numbering, edit/remove/read-only behavior, reactive renumbering via `useEditorState` — still hold; full list in the original section of this report's history / `git log`.)

## Coverage and known gaps

Full project suite: `npx vitest run` → **139/139 passing**. `npx tsc --noEmit` → 0 errors.

**Known, deliberately out-of-scope items** (not in the ticket's checkboxed acceptance criteria, called out explicitly rather than silently skipped):

- **GitBook's hover quick-insert icon row** (image/code/list/embed shortcuts next to an empty line) — mentioned in the ticket's descriptive section but not in its acceptance-criteria checklist. BlockNote doesn't ship this out of the box; building it would mean custom floating UI layered over BlockNote's own empty-block decoration, non-trivial effort for a shortcut to functionality (the slash menu) that's already fully working. Not built.
- **Step-level drag-to-reorder** — not independently verified by browser automation (tool limitation, explained above). Uses BlockNote's stock, unmodified drag-handle wiring; not a custom risk introduced by this feature.

## Merge evidence

No checkpoint commits were created — per the operator's standing instruction ("only create commits when the user explicitly asks"). This report, together with `git diff`, is the durable record of this round's RED → GREEN → live-verification sequence.

## Files changed (Round 2)

- `src/components/editor/slash-menu-items.tsx` — Stepper insertion now seeds each step with `children: [{ type: "paragraph" }]`
- `src/components/editor/slash-menu-items.test.ts` — updated assertion for the seeded paragraph body
- `src/components/editor/stepper-block.tsx` — "+" insert-after and the empty-stepper recovery button both now seed a paragraph body
- `src/components/editor/stepper-block.test.tsx` — updated/added headless tests for the seeded-paragraph behavior
