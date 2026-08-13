# TDD Evidence Report — Always-clickable trailing block after content-less blocks (screenshot, divider, stepper)

## Source plan

No `*.plan.md` was provided. User report: "when i add image media block, i can not add new block below the media block... it's good if you spare 1 or 2 empty blocks below latest block in pages."

## User journeys

1. As a Page editor, after inserting a screenshot (image) block as the last block on a page, I want to be able to click below it and keep writing, without hunting for a keyboard trick.
2. As a Page editor, the same should hold for any other content-less block (divider) left as the last block on the page.
3. As a Viewer (read-only), no extra blocks should ever be silently inserted into content I can't edit.

## Root cause

BlockNote's own "click below the last block to add a paragraph" affordance is a decoration-only widget (`TrailingNodeExtension`, `@blocknote/core`), not a real block. Live reproduction in Chrome (`dev` server, an existing page whose last block was a `screenshot`) showed the widget's ProseMirror plugin computes **zero decorations** immediately after page load, even though its own `shouldShowTrailingWidget` logic evaluates `true` for that exact document when run by hand against the live `editor.editorView.state`. Forcing any unrelated doc-changed transaction (e.g. insert-then-delete a space) immediately causes the plugin to recompute correctly and the widget appears — proving the logic is right but its initial computation on a freshly loaded document is not, for documents whose last block is a content-less custom block. This left users with a screenshot block as their last block completely unable to add anything below it — no widget, no keyboard path (content:"none" blocks accept no cursor).

## Task report

| Task | Summary | Validation | Result |
|---|---|---|---|
| Reproduce live | Opened an existing page (`edit pages nih`) whose last block is a `screenshot`; inspected the real `BlockNoteEditor` instance via `pmViewDesc`/React fiber in Chrome DevTools automation | `javascript_tool` against the running `dev` server | Confirmed: `trailingNode` plugin's `DecorationSet` has 0 decorations on load; forcing a transaction fixes it, proving a load-time-only defect in BlockNote's own extension |
| RED: unit tests for the fix | Wrote `trailing-paragraph-extension.test.tsx` — 5 headless tests for a new pure function `ensureTrailingParagraph`, plus 1 RTL-mounted integration test asserting a real second block appears after a screenshot block | `npx vitest run src/components/editor/trailing-paragraph-extension.test.tsx` | FAIL — `Failed to resolve import "./trailing-paragraph-extension"` (module didn't exist yet) |
| GREEN: implement the fix | Added `ensureTrailingParagraph(editor)` (checks `editor.schema.blockSchema[lastBlock.type].content === "none"`, appends a real empty `paragraph` via `editor.insertBlocks`) and `trailingParagraphExtension` (BlockNote extension wiring it to `mount()` + `editor.onChange()`) in `src/components/editor/trailing-paragraph-extension.ts`; wired into `page-editor.tsx`'s `extensions` array (`trailingParagraphExtension()` — the function-overload form of `createExtension` must be *called* to produce an `ExtensionFactoryInstance`, unlike the object-overload used by the existing `codeBlockExitExtension`) | `npx vitest run src/components/editor/trailing-paragraph-extension.test.tsx` | PASS — 6/6 |
| Regression check | Full project suite + typecheck + lint | `npx vitest run`, `npx tsc --noEmit`, `npx eslint ...` | PASS — 168/168 tests, 0 type errors, 0 lint issues |
| Live verification | Reloaded the same reproduction page in Chrome; confirmed the document now renders 6 blocks (was 5) with a real trailing `paragraph` after the `screenshot`; used the live editor instance to place the cursor in it and type text, confirming it's genuinely editable; cleared the test text and confirmed the clean state (6 blocks, empty trailing paragraph) persists across a fresh reload (autosave) | Manual, Chrome automation against the running `dev` server | Cursor lands correctly, text accepted, autosave persists the clean trailing-paragraph state |

## What is guaranteed by the passing tests

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | A content-less last block (screenshot) gets a real empty paragraph appended after it | `trailing-paragraph-extension.test.tsx:appends an empty paragraph after a content-less block (screenshot)...` | unit | PASS |
| 2 | A content-less last block (divider) gets a real empty paragraph appended after it | `trailing-paragraph-extension.test.tsx:appends an empty paragraph after a content-less block (divider)...` | unit | PASS |
| 3 | No duplicate trailing paragraph is added when one already exists (idempotent — self-terminating, no insert loop) | `trailing-paragraph-extension.test.tsx:does not add a second trailing paragraph...` | unit | PASS |
| 4 | A document whose last block already has editable content is left untouched | `trailing-paragraph-extension.test.tsx:leaves the document untouched...` | unit | PASS |
| 5 | Read-only editors (`editor.isEditable === false`, e.g. the Viewer role) never get content mutated | `trailing-paragraph-extension.test.tsx:does nothing when the editor is read-only` | unit | PASS |
| 6 | Wired into a real mounted `BlockNoteEditor` (via `mount()`), an already-loaded document ending in a screenshot self-heals to end in a paragraph | `trailing-paragraph-extension.test.tsx:fixes up an already-loaded document...` | integration (RTL) | PASS |

## Coverage and known gaps

Full project suite: `npx vitest run` → **168/168 passing**. `npx tsc --noEmit` → 0 errors. `npx eslint` on touched files → 0 issues.

- `src/components/public/public-page-content.tsx` (read-only published-page renderer) intentionally does **not** get this extension — it always renders with `editable={false}` and no `extensions` array, so there's nothing to add a block into; adding the extension there would be dead code.
- The upstream BlockNote decoration bug itself was not filed/reported anywhere outside this report — the fix here sidesteps it (a real block instead of a virtual widget) rather than patching `node_modules`, so no repo dependency on an unpatched upstream fix.

## Merge evidence

No checkpoint commits were created — per the operator's standing instruction ("only create commits when the user explicitly asks"). This report, together with `git diff`, is the durable record of this round's reproduction → RED → GREEN → live-verification sequence.
