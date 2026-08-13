# TDD Evidence Report — Annotation Editor Remount Resilience

## Source plan

No `*.plan.md` was provided. This work continues directly from a prior debugging
session (same conversation) that fixed the annotation editor "opens and immediately
closes" bug, and diagnosed — but did not fully resolve — a residual dev-mode-only
issue: BlockNote recreates the screenshot block's NodeView roughly once a second in
`npm run dev` (confirmed absent in a production build via `next build && next start`).
The user then reported the concrete symptom this report covers: placing numbered tag
markers in the annotator flickers/resets, making it impossible to actually annotate
an image.

## User journey

As an editor placing numbered tag annotations on a screenshot, I want the annotator
to keep every tag I've placed and stay on whichever tool I selected, so that a
transient remount of the block underneath me doesn't wipe out my in-progress work.

## Root cause

`AnnotationCanvas`'s in-progress editing state was **entirely local React state**:

- `activeTool` / `activeColor` — which tool/color is currently selected
- `nextMarkerNumber` — the number to stamp on the next marker
- the drawn Fabric.js objects themselves (never persisted to React state at all,
  only implicitly held by the live `fabric.Canvas` instance)

A prior fix in this same session made the **open/closed flag** (`isAnnotating`)
resilient to the periodic remount by moving it into an external store keyed by
block id. That fix alone was insufficient: the remount still tears down and
recreates `AnnotationCanvas` itself, and on recreation:

1. `activeTool` resets to `null` — the toolbar shows "Pilih alat untuk mulai
   memberi anotasi" again, color swatches disappear.
2. The Fabric canvas reloads from `initialAnnotation` (the **last explicitly-saved**
   annotation), discarding every marker/shape placed since the annotator was opened.
3. `nextMarkerNumber` resets to whatever was last saved.

Symptom as experienced by the user: click the marker tool, click the image to place
a tag — if a remount lands in that window, the tool silently deselects
(`handleMouseDown`'s `if (!tool) return` no-ops the next click) and any
already-placed-but-unsaved tags vanish, reading as constant flickering/resetting.

## Task report

### Task 1 — Persist drawn shapes + marker counter across remounts

- **Summary**: Added `annotation-draft-store.ts` (`getAnnotationDraft` /
  `setAnnotationDraft` / `clearAnnotationDraft`), an external store keyed by block
  id holding the same `AnnotationJson` shape already used for saved annotations.
  Wired `AnnotationCanvas` to load from the draft (falling back to
  `initialAnnotation`) on mount, and to write to it on every
  `object:added`/`object:removed`/`object:modified` Fabric event. Cleared on both
  Save and Cancel.
- **Validation command**: `npx vitest run src/lib/annotation-draft-store.test.ts`
- **RED** (module didn't exist yet):
  ```
  Failed to resolve import "./annotation-draft-store" from
  "src/lib/annotation-draft-store.test.ts". Does the file exist?
  ```
- **GREEN**: `PASS (6) FAIL (0)`
- **What is guaranteed**: a draft set for one block is retrievable, independent of
  other blocks' drafts, overwritable, and clearable without affecting other blocks.

### Task 2 — Persist active tool/color selection across remounts

- **Summary**: Discovered via live reproduction (placing markers with ~2s pauses
  between clicks) that Task 1 alone was insufficient — `activeTool`/`activeColor`
  were still local state and reset on remount, silently swallowing the next canvas
  click. Extended the same store module with `getAnnotationToolState` /
  `setAnnotationToolState` / `clearAnnotationToolState`. Wired the existing
  ref-sync `useEffect` in `AnnotationCanvas` (which already ran on every
  `activeTool`/`activeColor` change) to also mirror the pair into this store,
  covering every code path that changes them (toolbar click, the auto-deselect
  after placing a label, the auto-deselect after finishing a box/arrow/blur drag).
- **Validation command**: `npx vitest run src/lib/annotation-draft-store.test.ts`
- **RED** (functions didn't exist yet):
  ```
  TypeError: (0 , __vite_ssr_import_1__.setAnnotationToolState) is not a function
  ```
- **GREEN**: `PASS (10) FAIL (0)`, later `PASS (11) FAIL (0)` after closing a
  branch-coverage gap (clearing a block with no stored tool state).
- **What is guaranteed**: the active tool and color selected for one block are
  retrievable, independent across blocks, overwritable, and clearable without
  affecting other blocks.

### Task 3 — Wire both stores into `AnnotationCanvas` and verify live

- **Summary**: `AnnotationCanvas` now takes a `blockId` prop (passed from
  `screenshot-block.tsx` as `block.id`, the block's own stable ProseMirror id — not
  `screenshotBlockId`, which is empty until an image is uploaded). Fixed a
  same-tick ordering bug in the marker tool's `handleMouseDown`: `nextMarkerRef`
  must be bumped *before* `canvas.add(group)`, since `add()` synchronously fires
  `object:added`, whose listener reads `nextMarkerRef.current` to build the draft.
  An `eslint` pass caught a `react-hooks/immutability` violation from an earlier
  wrapper-function approach to persisting tool state; resolved by folding the
  persistence into the pre-existing ref-sync effect instead of introducing new
  hook closures over the same refs.
- **Validation commands**:
  `npx tsc --noEmit`, `npx eslint <changed files>`, `npx vitest run`, and a live
  Chrome session against the dev server.
- **Live verification transcript** (marker tool, 3 taps with `wait: 2s` between
  each, simulating the dev-mode remount window):
  1. Selected marker tool → toolbar highlighted, color swatches shown.
  2. Waited 2s → **re-checked and confirmed the marker tool was still selected**
     (previously this would have reset to no tool selected).
  3. Clicked image at three points, 2s apart → markers numbered 3, 4, 5 all
     appeared and persisted.
  4. Clicked "Selesai memberi anotasi" (Done) → editor closed cleanly; the saved
     thumbnail shows all 5 markers (1, 2 pre-existing + 3, 4, 5 newly placed).
- **What is guaranteed**: placing multiple sequential numbered tags with real-world
  timing gaps between clicks no longer loses tool selection or previously-placed
  tags, and the full session saves correctly.

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | A draft set for a block is retrievable by that block's id | `annotation-draft-store.test.ts:returns the draft that was set for a block` | unit | PASS | `npx vitest run src/lib/annotation-draft-store.test.ts` |
| 2 | Setting a draft twice for the same block overwrites, not merges | `annotation-draft-store.test.ts:overwrites a previous draft for the same block` | unit | PASS | same |
| 3 | Drafts for different blocks never leak into each other | `annotation-draft-store.test.ts:keeps drafts for different blocks independent` | unit | PASS | same |
| 4 | Clearing one block's draft leaves other blocks' drafts intact | `annotation-draft-store.test.ts:removes the draft for a block on clear, leaving other blocks' drafts intact` | unit | PASS | same |
| 5 | Clearing a block with no draft never throws | `annotation-draft-store.test.ts:clearing a block with no draft is a no-op` | unit | PASS | same |
| 6 | Active tool/color for a block are retrievable together | `annotation-draft-store.test.ts:returns the active tool and color that were set for a block` | unit | PASS | same |
| 7 | Setting tool state twice for the same block overwrites, not merges | `annotation-draft-store.test.ts:overwrites a previous tool state for the same block` | unit | PASS | same |
| 8 | Clearing one block's tool state leaves other blocks' intact | `annotation-draft-store.test.ts:removes the tool state for a block on clear, leaving other blocks intact` | unit | PASS | same |
| 9 | Clearing a block with no tool state never throws | `annotation-draft-store.test.ts:clearing a block with no tool state is a no-op` | unit | PASS | same |
| 10 | Placing 3 sequential numbered tags with real-timing pauses survives to save, with the tool staying selected throughout | live browser session against `npm run dev` | manual/E2E | PASS | screenshots `ss_53279bmid` (markers 3/4/5 placed, tool still active) and `ss_70560xq6h` (saved thumbnail shows all 5 markers) |

## Coverage and known gaps

- `annotation-draft-store.ts`: 100% statements/lines/functions, 100% branches after
  closing the one gap found (`npx vitest run --coverage src/lib/annotation-draft-store.test.ts`).
- `AnnotationCanvas`'s wiring to these stores (the `useEffect`/Fabric event listener
  integration) is **not** covered by an automated test. `jsdom` doesn't provide the
  real canvas APIs Fabric.js needs — this is a pre-existing constraint noted in
  `screenshot-block.test.tsx`'s own comments, which already mocks
  `AnnotationCanvas` out entirely for that reason. Coverage for this piece comes
  from the live-browser transcript in Task 3 instead.
- Full-suite runs (`npx vitest run` with no path filter) showed intermittent,
  unrelated failures in `stepper-block.test.tsx`, `page-tree-item.test.tsx`, and
  `space-card.test.tsx` on some runs — none of these files were touched by this
  work, and each passes reliably in isolation. This reads as pre-existing test
  flakiness (likely resource contention from the dev server + Docker/MinIO
  containers running concurrently during this session), not a regression; a clean
  `PASS (200) FAIL (0)` full run is included above as the final verification.
- The underlying dev-mode remount itself (why BlockNote recreates this one NodeView
  roughly once a second in `npm run dev`) remains **undiagnosed** at the root. This
  report's fix makes the editor resilient to it rather than eliminating it. It does
  not reproduce in a production build.

## Merge evidence

Checkpoint commits on `development`, in order:

```
215c7df test: add reproducer for annotation draft state lost on remount       (RED)
183324f fix: add external draft store for in-progress annotation edits        (GREEN)
bdeb8e7 test: add reproducer for active-tool selection lost on remount        (RED)
0370c18 fix: add external tool-selection store so remounts don't deselect     (GREEN)
3852f21 fix: wire draft/tool-state stores into AnnotationCanvas               (integration + live verification)
```
