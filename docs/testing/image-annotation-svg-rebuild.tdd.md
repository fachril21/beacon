# TDD Evidence Report — Image Annotation Feature, Rebuilt on SVG

## Source plan

No `*.plan.md` file. Produced inline via `/plan` (conversational mode) after
the user asked to re-add annotation tooling to the Image Block — this is a
deliberate second attempt: a prior Fabric.js-based implementation was built,
debugged across three separate TDD cycles, and ultimately removed by the
user ("i didn't see any changes in visual or experience. it still broke for
me. i want you to remove annotation feature for image block."). The inline
plan (reproduced in full in the conversation, approved by the user with
"yes proceed") investigated why the prior attempt failed before proposing a
different architecture. See "Root cause of the prior attempt's failure"
below.

## User journey

As an editor writing a guide, I want to mark up an uploaded screenshot with
numbered step markers, arrows, boxes, and text labels, so that readers can
follow along visually — and I want those markup edits to actually stick
(not flicker, reset mid-drag, or silently drop shapes), and to still be
there after I reload the page.

## Root cause of the prior attempt's failure

Read from the prior attempt's own TDD evidence reports
(`docs/testing/annotation-remount-resilience.tdd.md`,
`docs/testing/annotation-editor-flicker-mitigation.tdd.md`,
`docs/testing/annotation-box-shape-dot-fix.tdd.md`, all still in the repo)
plus `git show` on the commits that built and later removed the feature:

- BlockNote recreates the screenshot block's NodeView roughly every
  150–400ms in `npm run dev` (confirmed dev-only, absent in a production
  build), for reasons never root-caused at the framework level.
- The prior implementation used Fabric.js, an imperative canvas library
  that owns its own `<canvas>` DOM node and must fully `dispose()`/recreate
  on every remount. Three separate fix cycles (external draft store,
  external tool-selection store, per-frame draft persistence) each closed
  one gap and exposed another — a box/arrow tool that permanently drew a
  1×1 dot because the growing shape was never flushed to the remount-safe
  store until the gesture ended, tool selection dropping mid-session,
  browser-automation tooling itself unable to reliably drive Fabric's
  canvas because it listens for pointer events while the automation
  dispatched mouse events.
- The persisted data was Fabric's own opaque serialized JSON
  (`canvas.toJSON()`), not structured `{type, position, color, text}` data —
  the read-only view had to hand-roll an SVG renderer that reverse-engineers
  Fabric's internal PascalCase object format.

## Chosen architecture (see inline plan for full rationale)

Hand-rolled SVG overlay, no canvas library. Declarative rendering (a
remount just re-renders the same JSX from data, no imperative teardown) and
a real structured `Annotation` type stored in the pre-existing (previously
unused) `annotation_json` jsonb column — no migration needed. Every
intermediate frame of a create/move drag is optimistically written straight
into the same `screenshotBlocksStore` that already backs the image and
description (which never flickered under the remount), instead of a
separate draft store, closing the exact "shape frozen at its creation dot"
bug class by construction rather than by patching around it.

## Task report

### Task 1 — Structured `Annotation` type + `annotation_json` mapping

- **Summary**: Added `AnnotationShapeType`/`Annotation` to `lib/types.ts`
  and `annotations: Annotation[]` to `ScreenshotBlock`. Extended
  `mapScreenshotBlockRow` to map the (already-existing, previously-unused)
  `annotation_json` column to `annotations`, defaulting `null` to `[]`.
- **Validation**: `npx vitest run src/lib/supabase/mappers.test.ts`
- **RED**: 3 new assertions failed — `annotations` missing from the mapped
  object / `undefined` instead of `[]` or the populated array.
- **GREEN**: `PASS (11) FAIL (0)`
- **What is guaranteed**: a null `annotation_json` column maps to `[]`, not
  `null`; a populated column maps to the structured array unchanged.

### Task 2 — Remount-resilient active-tool store

- **Summary**: Added `lib/annotation-tool-store.ts`, reusing the codebase's
  existing `createStore()` external-store pattern (already used elsewhere
  in this file for the annotate-mode open/closed flag) keyed by block id,
  plus a `useActiveAnnotationTool` hook. This is the one piece of editor
  state proven (by the prior attempt's own reports) to cause real user
  pain if left in local `useState`.
- **Validation**: `npx vitest run src/lib/annotation-tool-store.test.ts`
- **RED**: `Failed to resolve import "./annotation-tool-store"`
- **GREEN**: `PASS (7) FAIL (0)`
- **What is guaranteed**: tool selection is independent per block,
  overwritable, and a subscribed hook stays in sync with external
  `setActiveAnnotationTool` calls.

### Task 3 — Persistence hooks

- **Summary**: Added `useUpdateScreenshotAnnotations` (mirrors the existing
  `useUpdateScreenshotDescription` shape exactly: Supabase update + store
  patch, async, throws on error) and `usePatchScreenshotAnnotationsLocal`
  (new — store-only, no network, for high-frequency intermediate drag
  frames; documented deviation from "reuse the exact existing pattern",
  justified by the prior attempt's documented drag-interruption bug).
- **Validation**: `npx vitest run src/hooks/use-screenshot-blocks.test.ts`
- **RED**: `TypeError: useUpdateScreenshotAnnotations is not a function` /
  `usePatchScreenshotAnnotationsLocal is not a function`
- **GREEN**: `PASS (10) FAIL (0)`
- **What is guaranteed**: annotations write to `annotation_json` and patch
  the store on success; the store is untouched on a Supabase error (and the
  call rejects, so the caller can surface a retry toast); the local-only
  patch never calls Supabase and never touches other blocks' rows.

### Task 4 — Read-only `AnnotationOverlay`

- **Summary**: Plain SVG renderer, `viewBox` set to the image's own native
  pixel size (fractional 0..1 coordinates convert via `x * imageWidth`), no
  separate canvas-size utility needed. Renders all four required shapes.
- **Validation**: `npx vitest run src/components/editor/annotation-overlay.test.tsx`
- **RED**: `Failed to resolve import "./annotation-overlay"`
- **GREEN**: `PASS (8) FAIL (0)`
- **What is guaranteed**: empty annotations render nothing; each shape type
  (box/arrow/marker/label) renders at its correct fractional position; the
  overlay is `pointer-events-none` so it never blocks the image beneath it.

### Task 5 — Interactive `AnnotationEditorOverlay`

- **Summary**: Toolbar (4 required tools + 5 color swatches) and an
  interactive SVG overlay using plain `onPointerDown`/window-level
  `pointermove`/`pointerup` listeners — no third-party canvas library, so
  (unlike the prior Fabric implementation) this is directly unit-testable
  with RTL's `fireEvent.pointer*`, no real canvas API needed. Marker/label
  place instantly on click; box/arrow grow via drag, writing every
  intermediate frame through `onAnnotationsChange`; existing shapes are
  selectable, draggable, and deletable (Delete/Backspace); labels get an
  inline `<input>` editor via `foreignObject`.
- **Two real bugs found and fixed during this cycle** (both via genuine
  RED failures, not anticipated in advance):
  1. Drag-frame math initially relied on the `annotations` prop reflecting
     the component's own just-emitted writes — true in the real app (the
     store round-trips through `useSyncExternalStore` quickly) but not in
     an isolated unit test with a bare mock callback. Fixed by having the
     component track its own writes in a ref (`commit()`) instead of
     waiting on the prop round-trip — a more correct design for the real
     remount scenario too, since it no longer depends on render timing.
  2. Binary floating-point noise (`0.3 - 0.1 = 0.19999999999999998`)
     leaking into stored fractions. Fixed by rounding all committed
     fractions to 4 decimal places.
- **Validation**: `npx vitest run src/components/editor/annotation-editor-overlay.test.tsx`
- **RED → GREEN progression**: 11/14 → 13/14 (after the `commit()` ref fix)
  → 14/14 (after the `round4` fix). A later coverage pass added 3 more
  tests (arrow move, swatch color selection, label-input
  `stopPropagation`), one of which caught a genuine test-authoring bug
  (a stray unfinished drag session from an unclosed `pointerUp` in the
  test itself, not a component bug) before landing at `PASS (17) FAIL (0)`.
- **What is guaranteed**: every tool creates the correct shape type at the
  correct position; a box/arrow drag's intermediate frames are already
  reflected in `onAnnotationsChange` calls, not just the final frame (the
  prior attempt's "renders as a dot" bug, structurally prevented); shapes
  are selectable/movable/deletable; an arrow's move preserves its shaft
  vector; clicking into a label's text input doesn't start dragging the
  label.

### Task 6 — Wiring into `screenshot-block.tsx`

- **Summary**: Reintroduced the `isAnnotating`-per-block external store
  (same `createStore()` pattern the file already used before removal) to
  toggle a dedicated annotate mode. Read-only and non-annotating-editable
  branches render `<AnnotationOverlay>` over the image; annotate mode
  renders `<AnnotationEditorOverlay>` wrapping the image. A new
  `handleAnnotationsChange` mirrors the existing `handleDescriptionChange`
  debounce-in-component pattern (setTimeout, `useRef` for the timer) but
  additionally calls `usePatchScreenshotAnnotationsLocal` immediately
  before scheduling the debounced network save.
- **Validation**: `npx vitest run src/components/editor/screenshot-block.test.tsx`
- **RED**: `Kotak` tool-palette button not found (no annotate mode wired
  yet); repeated for the read-only-overlay and exit-annotate-mode cases.
- **GREEN**: `PASS (7) FAIL (0)` after wiring, plus a coverage pass adding
  a debounce-timing test that caught a real mock-setup bug (the test's
  `useUpdateScreenshotAnnotations` mock didn't return a Promise, so the
  component's `.catch()` threw) — fixed in the test, not the component.
- **What is guaranteed**: annotations render on top of the image in every
  render mode; clicking the thumbnail enters annotate mode; "Selesai"
  exits it; placing a shape patches the store immediately and debounce-saves
  to Supabase 500ms later.

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | Null `annotation_json` maps to `[]` | `mappers.test.ts` | unit | PASS |
| 2 | Populated `annotation_json` maps unchanged | `mappers.test.ts` | unit | PASS |
| 3 | Tool selection independent per block, survives external updates | `annotation-tool-store.test.ts` | unit | PASS |
| 4 | `useUpdateScreenshotAnnotations` writes + patches store; rejects and leaves store untouched on error | `use-screenshot-blocks.test.ts` | unit | PASS |
| 5 | `usePatchScreenshotAnnotationsLocal` never calls Supabase, never touches other blocks | `use-screenshot-blocks.test.ts` | unit | PASS |
| 6 | Each shape type renders at the correct fractional position; overlay is non-interactive | `annotation-overlay.test.tsx` | unit | PASS |
| 7 | Marker/label place instantly; box/arrow grow per-frame during drag (not just on release) | `annotation-editor-overlay.test.tsx` | unit | PASS |
| 8 | Shapes are selectable, movable (incl. arrow shaft preservation), deletable | `annotation-editor-overlay.test.tsx` | unit | PASS |
| 9 | Label inline editor updates text; clicking into it doesn't start a drag | `annotation-editor-overlay.test.tsx` | unit | PASS |
| 10 | Annotate mode toggles on thumbnail click / "Selesai"; overlay renders in every mode | `screenshot-block.test.tsx` | unit | PASS |
| 11 | `handleAnnotationsChange` patches locally immediately, debounce-saves after 500ms | `screenshot-block.test.tsx` | unit | PASS |
| 12 | Live: create box/marker, reload, annotations persist from real Supabase; move + delete work; page left clean after test | manual/E2E, live `npm run dev` against the hosted Supabase instance | manual | PASS |

## Coverage and known gaps

- New/changed files (`npx vitest run --coverage`): `annotation-editor-overlay.tsx` 96.1% stmts / 100% lines; `annotation-overlay.tsx` 95.2% stmts / 95% lines; `annotation-tool-store.ts` 90% stmts; `use-screenshot-blocks.ts` 78.9% stmts (the uncovered lines are the pre-existing, already-untested `useUpdateScreenshotDescription`/`useUploadScreenshot` error paths, not new code); `screenshot-block.tsx` 68.2% stmts (remaining gap is pre-existing `handleDescriptionChange`/`handleUpload`, untested before this session too).
- Full suite: `npx vitest run` → `PASS (312) FAIL (0)`. `npx tsc --noEmit` clean. `npx eslint` clean on every changed file.
- **Project-wide `npm run test:coverage` does not meet the 80% global threshold** (74.95% statements at last check) — this is a pre-existing condition, not a regression from this work. The shortfall is entirely in files this task never touched (`comment-thread-panel.tsx` 2.4%, `popover.tsx` 14.3%, `dropdown-menu.tsx` 37.5%, `screenshot-upload-prompt.tsx` 17.6%, `slash-menu-items.tsx` 42.9%, `use-pages.ts`/`use-spaces.ts`/`use-versions.ts` in the 55–65% range, etc.). Backfilling those would violate the task's explicit hard constraint to touch nothing outside the Image Block.
- A couple of intentionally-uncovered lines remain in the new files themselves: `useSyncExternalStore`'s SSR-snapshot fallback in `annotation-tool-store.ts` (unreachable in a client-rendered jsdom test, same as the pattern already used elsewhere in this codebase) and a `default: return null` dead branch in `annotation-overlay.tsx` guarded by a closed union type.
- Optional extras discussed in the plan (ellipse/circle shape, duplicate-annotation action) were **not** built — the user was offered them and did not request them; scope stayed to the four required tools.
- Live E2E verification could not exercise the image-upload path itself (local MinIO/Docker unavailable in this environment) — but the target Supabase project is a real hosted instance, so annotation CRUD against an **existing** screenshot block was fully live-verified end to end (create → optimistic render → debounced Supabase write → hard reload → still there → move → delete → reload → gone), with zero console errors and zero visual flicker/reset observed across the whole session.

## Merge evidence

Checkpoint commits on `development`, in order:

```
28c3ba1 test: add reproducer for annotation_json mapping on screenshot_blocks rows
4d45c34 feat: add structured Annotation type and map annotation_json to it
079fc35 fix: satisfy the new required ScreenshotBlock.annotations field in fixtures
4082811 test: add reproducer for annotation active-tool store
96766e5 feat: add remount-resilient active-tool store for the annotation editor
889ff55 test: add reproducer for annotation persistence hooks
a607e3d feat: add useUpdateScreenshotAnnotations + local-only optimistic patch hook
2daeed3 test: add reproducer for read-only annotation SVG overlay
fce51bc feat: add read-only SVG AnnotationOverlay (marker/arrow/box/label)
4721011 test: add reproducer for interactive annotation editor overlay
5315849 feat: add interactive SVG AnnotationEditorOverlay (create/select/move/delete)
90ca7e2 refactor: give AnnotationEditorOverlay a children slot so its SVG has a real sized ancestor
c2ee6ca test: add reproducer for annotation wiring in screenshot-block
5da7126 feat: wire annotation overlays into screenshot-block (view/edit/annotate modes)
795c2b0 test: cover handleAnnotationsChange's local-patch + debounced save
60afab1 test: cover arrow move, swatch color selection, and label-input stopPropagation
```

Files changed (all confined to the Image/Screenshot Block area, per the
task's hard constraint):

- `src/lib/types.ts` (modified — `Annotation` type)
- `src/lib/supabase/mappers.ts` (modified — `annotation_json` mapping)
- `src/lib/annotation-tool-store.ts` (new)
- `src/hooks/use-screenshot-blocks.ts` (modified — 2 new hooks)
- `src/components/editor/annotation-overlay.tsx` (new)
- `src/components/editor/annotation-editor-overlay.tsx` (new)
- `src/components/editor/screenshot-block.tsx` (modified — wiring)
- `src/lib/mock/screenshot-blocks.ts` (modified — fixture field)
- Matching `*.test.ts(x)` for every file above

No database migration was needed — `annotation_json` already existed as a
nullable jsonb column from the original baseline schema.
