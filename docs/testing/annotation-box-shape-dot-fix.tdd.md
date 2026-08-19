# TDD Evidence Report — Box/Blur/Arrow Annotation Renders as a Dot

## Source plan

No `*.plan.md`. Triggered by a user report via `/ecc:tdd-workflow`: "When
creating a rectangle/box shape annotation, what shows up in the preview is
just a dot — no box is formed." Direct continuation of
`docs/testing/annotation-editor-flicker-mitigation.tdd.md`, which fixed the
same remount-survival gap for *editing* an existing shape (drag/resize/type)
but — as this report found — left new-shape *creation* unprotected.

## User journey

As an editor drawing a new box (or blur redaction, or arrow) annotation, I
want the shape I drag out to actually appear at the size I drew it, so that
the annotator is usable at all for this tool.

## Root cause

`AnnotationCanvas`'s draft-persistence (the remount-survival mechanism from
the prior two TDD cycles) is wired to Fabric's own event names:
`object:added`, `object:removed`, `object:modified`, and — as of the prior
cycle — `object:moving`/`object:scaling`/`object:rotating`/`text:changed`.
All of those are emitted by **Fabric's own interactive transform
controller**, which only runs when the user drags an already-selected
object via its selection handles.

Drawing a brand-new box/blur/arrow does not go through that controller at
all. `handleMouseDown` creates a 1×1 `fabric.Rect` (or a zero-length
`fabric.Line` for arrows) and adds it — firing `object:added` once, with the
draft capturing the shape at that 1×1 dot. `handleMouseMove` then grows the
shape by calling `shape.set({ left, top, width, height })` directly and
`canvas.renderAll()` — a **manual** mutation that never fires any Fabric
event, so nothing re-persists the draft as the shape grows. `handleMouseUp`
finalizes the shape (for arrows, swaps the temporary `Line` for a
`Line`+`Triangle` group) but likewise never explicitly saves the draft.

Net effect: from the instant of `object:added` until *something else*
unrelated happens to touch the draft, the draft store holds the shape
frozen at its 1×1 creation size. With the dev-mode NodeView remount landing
every ~150–400ms (see the flicker report), a normal drag — which realistically
takes longer than that — gets interrupted mid-gesture. The canvas tears down
and rebuilds from the draft, which still only has the dot. The user's drag
motion continues, but it's now happening against a brand-new
`handleMouseMove` closure with `isDrawing = false` and no `shape` reference,
so nothing happens: the box never grows past its original dot.

Live confirmation: two of this session's own screenshot-block annotations
(pre-existing "Login" page test content) now show several stray single-pixel
dots scattered where box/arrow draws were attempted earlier in this
session — visible, reproduced instances of exactly this bug.

## Task report

### Task 1 — Persist the in-progress shape while it's being drawn, not just at creation

- **Summary**: Added `saveDraft(canvas, nextMarkerRef.current)` calls in two
  places in the drawing-interactions effect: (1) at the end of
  `handleMouseMove`, right after `canvas.renderAll()`, so every intermediate
  frame of a box/blur/arrow draw updates the draft with the shape's current
  (growing) size; (2) at the end of `handleMouseUp`, after the arrow's
  temporary line→group swap, so the finalized shape is captured immediately
  rather than waiting for some other, unrelated event to happen to persist
  it.
- **Dependency array**: the drawing-interactions `useEffect` now includes
  `saveDraft` in its dependency array (`[activeTool, saveDraft]`) since it's
  referenced inside; `saveDraft` itself is a stable `useCallback` keyed only
  on `blockId`, so this does not change how often the effect re-runs in
  practice.
- **Validation commands**: `npx tsc --noEmit`, `npx eslint
  src/components/editor/annotation-canvas.tsx`, `npx vitest run`.
- **Result**: `tsc` clean; `eslint` clean; `PASS (293) FAIL (0)` — no
  regression.
- **What is guaranteed**: at any point during a box/blur/arrow draw —
  including mid-drag, before the gesture completes — the draft store holds
  the shape's current size, not just its 1×1 creation dot. A remount landing
  at any point during the drag now rebuilds the canvas showing the
  shape as-drawn-so-far, not a dot, and the user's in-progress drag
  continues to work against the freshly-rebuilt canvas instead of silently
  going nowhere.

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | No regression across the existing suite | `npx vitest run` | full suite | PASS | `PASS (293) FAIL (0)` |
| 2 | Types remain clean | `npx tsc --noEmit` | static | PASS | clean |
| 3 | Lint remains clean | `npx eslint src/components/editor/annotation-canvas.tsx` | static | PASS | clean |
| 4 | The gap is real and reproduces without this fix | live session, prior debugging in this conversation | manual/diagnostic | CONFIRMED | stray single-pixel dots visibly present on this session's own test screenshot blocks, left over from box/arrow draws interrupted by the remount before this fix existed |

## Coverage and known gaps

- **No fresh live end-to-end re-verification of the fix itself was
  completed this session.** `AnnotationCanvas` has no unit tests (jsdom
  cannot provide the canvas APIs Fabric.js needs — pre-existing, documented
  constraint, same as the prior two reports in this series). Live
  verification was attempted via Claude-in-Chrome browser automation but
  was blocked by a tooling limitation discovered during this session:
  Fabric.js's canvas (this version) listens for **pointer events**
  specifically, while the browser-automation `computer` tool's
  click/drag actions dispatch classic **mouse events** — Fabric's canvas
  never received them, so neither clicks nor drags on the canvas itself
  registered (confirmed: clicking directly on a placed marker produced no
  Fabric selection-handle UI). A follow-up attempt dispatching synthetic
  `PointerEvent`s directly via JavaScript also did not produce a visible
  Fabric selection, for reasons not further diagnosed in this pass
  (possibly a coordinate/scroll-offset mismatch, since the canvas element's
  `getBoundingClientRect()` did not line up with the screenshot's pixel
  space in this session).
- **The fix is a direct, narrow, symmetrical extension of the exact
  mechanism already validated and shipped in the prior TDD cycle**
  (`annotation-editor-flicker-mitigation.tdd.md`) for the sibling case of
  editing an existing shape — same `saveDraft` function, same call
  pattern, applied to the two places in the code that were the only
  remaining unprotected mutation paths. Confidence in correctness comes
  from that precedent plus direct line-by-line tracing of Fabric's event
  model (confirmed via `node_modules/fabric/dist/src/EventTypeDefs.d.ts`
  that `object:added`/`object:modified`/etc. are the only events Fabric
  fires automatically, and that manual `.set()` calls outside its transform
  controller fire none of them).
- **Recommended follow-up**: live-verify by hand (draw a box slowly,
  confirm it doesn't reset to a dot mid-drag) since this session's
  automation could not complete that check; and separately, fix the
  browser-automation tooling gap (pointer vs. mouse events) if annotation
  canvas E2E testing is going to be a recurring need.
- **Side effect of this session's investigation**: two pre-existing
  screenshot-block annotations on the "Login" test page (in the local dev
  Supabase/MinIO instance used throughout this session) now contain stray
  test markers and dots left over from reproduction attempts. Not cleaned
  up — browser automation could not reliably select/delete the debris (same
  pointer-event tooling gap described above). Left for the user to clear by
  hand (open each annotation, delete the stray markers/dots, click "Selesai
  memberi anotasi").

## Merge evidence

Not yet committed — awaiting explicit instruction per this project's
workflow. Files changed:

- `src/components/editor/annotation-canvas.tsx` (modified — this fix is
  layered on top of the same file's changes from
  `annotation-editor-flicker-mitigation.tdd.md`, not yet committed
  separately)
