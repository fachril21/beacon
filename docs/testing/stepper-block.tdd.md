# TDD Evidence Report — Stepper custom block

## Source plan

No `*.plan.md` was provided. User journeys below were derived during this TDD run from the user's request: "create 1 custom block — build a stepper block", modeled on [GitBook's stepper block](https://gitbook.com/docs/create-content/blocks/stepper) and adapted to Beacon's brand and BlockNote's prop constraints (BlockNote custom-block props may only be `string | number | boolean` — there is no per-step rich-text child slot, so each step's title/description are plain-text fields persisted as a JSON string prop, matching the existing `screenshot` custom block's pattern of a plain-text `Textarea` description).

## User journeys

1. As a Page editor, I want to insert a Stepper block from the slash menu, so that I can document a sequential process (e.g. "how to reset a password") the same way GitBook lets me.
2. As a Page editor, I want the stepper to start with a sensible default (two numbered, visually connected steps) so I don't start from a blank block.
3. As a Page editor, I want to edit each step's title and description inline, so I can fill in the process without leaving the editor.
4. As a Page editor, I want an "Add step" affordance below the last step, so I can extend the sequence.
5. As a Page editor, I want to remove a step (but never the last remaining one), so the stepper always represents a valid sequence.
6. As a Viewer (read-only role) or a visitor to a published page, I want to see the stepper's numbered, connected steps as static text, with zero edit affordances, so I can follow the instructions without being confused by controls I can't use.

## Task report

| Task | Summary | Validation command | Result |
|---|---|---|---|
| RED | `stepper-block.test.tsx` written first, importing a not-yet-created `./stepper-block` module | `npx vitest run src/components/editor/stepper-block.test.tsx` | FAIL — `Failed to resolve import "./stepper-block"` |
| GREEN | Implemented `stepper-block.tsx` (`parseStepperSteps` + `stepperBlockSpec` via `createReactBlockSpec`), wired into `schema.ts` and `slash-menu-items.tsx` | `npx vitest run src/components/editor/stepper-block.test.tsx` | PASS — 10/10, then 12/12 after coverage-gap follow-up tests |
| Regression | Existing `slash-menu-items.test.ts` asserted the full, exact list of menu item titles — updated to include the new "Stepper" entry | `npx vitest run src/components/editor` | PASS — 31/31 |
| Typecheck | Full project typecheck after wiring the new block into the shared `editorSchema` | `npx tsc --noEmit --pretty false` | `TypeScript: No errors found` |
| Visual QA | Rendered the block live in the running dev server (temporary auth-free preview route, deleted after use) with editable and read-only variants; exercised add/edit/delete interactions via the real browser | Manual, via Chrome automation | Numbered circles + connecting line, add/remove/edit all worked; read-only mode showed static text with no controls |

## What is guaranteed by the passing tests

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | A valid `stepsJson` array round-trips through `parseStepperSteps` unchanged | `stepper-block.test.tsx:parses a valid steps JSON array` | unit | PASS | `npx vitest run stepper-block.test.tsx` |
| 2 | Malformed (non-JSON) `stepsJson` falls back to the two-step default instead of throwing | `stepper-block.test.tsx:falls back to two default steps when given malformed JSON` | unit | PASS | same |
| 3 | An empty-array `stepsJson` falls back to the two-step default | `stepper-block.test.tsx:falls back to two default steps when given an empty array` | unit | PASS | same |
| 4 | Valid JSON that parses but isn't an array falls back to the two-step default | `stepper-block.test.tsx:falls back to two default steps when given valid JSON that isn't an array` | unit | PASS | same |
| 5 | Entries missing `id`/`title`/`description` are dropped; well-formed entries in the same array survive | `stepper-block.test.tsx:drops malformed entries but keeps well-formed ones` | unit | PASS | same |
| 6 | Inserting the block fresh renders two default, numbered, editable steps | `stepper-block.test.tsx:renders two default numbered steps when inserted fresh` | component | PASS | same |
| 7 | Clicking "Tambah langkah" appends a new step, editable immediately | `stepper-block.test.tsx:lets an editor add a new step via the add-step button` | component | PASS | same |
| 8 | Typing into a step's title/description input updates that field's value | `stepper-block.test.tsx:lets an editor edit a step's title and description` | component | PASS | same |
| 9 | Clicking a step's delete button removes only that step when 2+ steps exist | `stepper-block.test.tsx:lets an editor remove a step when more than one remains` | component | PASS | same |
| 10 | The delete button never renders when only one step remains (can't remove the last step) | `stepper-block.test.tsx:does not allow removing the last remaining step` | component | PASS | same |
| 11 | Read-only (Viewer / published-page) rendering shows static title/description text with zero inputs or add/remove buttons | `stepper-block.test.tsx:renders static text with no edit affordances for a read-only Viewer` | component | PASS | same |
| 12 | Read-only rendering falls back to a numbered placeholder title (`Langkah N`) when a step's title is empty | `stepper-block.test.tsx:falls back to a numbered placeholder title in read-only mode when a step has no title` | component | PASS | same |
| 13 | The slash menu's full item list (now 11 items, including "Stepper") stays in its pinned order | `slash-menu-items.test.ts:pins the Tangkapan Layar (screenshot) item first...` | unit | PASS | `npx vitest run src/components/editor` |

## Coverage and known gaps

`npx vitest run --coverage src/components/editor/stepper-block.test.tsx` (isolated to the new file's own contribution — the printed *global* threshold failure in that run reflects every other unrelated file in the repo not being exercised by this single-file run, not this feature):

```
stepper-block.tsx | 96.66 (stmts) | 96.55 (branch) | 100 (funcs) | 100 (lines)
```

The full editor suite (`npx vitest run src/components/editor`) passes 31/31, including the pre-existing `screenshot-block.test.tsx` and `page-editor.test.tsx`, confirming no regression from adding the `stepper` block to the shared `editorSchema`.

**Known, intentional gaps:**

- `handleRemoveStep`'s internal `if (steps.length <= 1) return;` guard line is not directly exercised. The delete button is never rendered when only one step remains (test #10 above covers that), so this line is unreachable through the UI in normal use; it exists only as a defensive backstop and is not worth a synthetic direct-call test.
- Step title/description text is **not** picked up by `src/lib/extract-text.ts` (used for search snippets and the "nearly empty page" check), because `extractPlainText` only walks `block.content`/`block.children`, not custom block props. This mirrors the existing `screenshot` block's `description` field, which is also outside that extraction (its text lives in a separate DB table instead of block props, but the outcome — un-indexed — is the same). Extending `extract-text.ts` to understand custom-block props was judged out of scope for "create 1 custom block" and is a pre-existing pattern gap, not a regression.

## Merge evidence

No checkpoint commits were created for this change — per the operator's standing instruction ("only create commits when the user explicitly asks"), combined with the working tree already carrying a large, unrelated in-progress migration (Lexical → BlockNote) from a prior session that this change should not be bundled with. RED → GREEN → coverage-hardening was validated live via the commands and outputs quoted above; this report is the durable record of that sequence.

## Files changed

- `src/components/editor/stepper-block.tsx` (new) — the block itself
- `src/components/editor/stepper-block.test.tsx` (new) — unit + component tests
- `src/components/editor/schema.ts` — registered `stepper` in `editorSchema.blockSpecs`
- `src/components/editor/slash-menu-items.tsx` — added the "Stepper" slash-menu entry (new "Tata letak" group)
- `src/components/editor/slash-menu-items.test.ts` — updated the exact-order assertion to include "Stepper"
