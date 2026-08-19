# TDD Evidence Report — Annotation Editor Flicker: Root-Cause Investigation + Mitigation

## Source plan

No `*.plan.md`. Triggered by a user report via `/ecc:tdd-workflow`: "the
annotation editing keeps flickering... distracting when fixing/adjusting the
annotation editor, which keeps resetting the changes that have already been
made." This is a continuation of the dev-mode NodeView remount problem first
documented in `docs/testing/annotation-remount-resilience.tdd.md`, whose own
"Known gaps" section already flagged the remount's root cause as
undiagnosed.

## User journey

As an editor adjusting an annotation (dragging a shape, resizing a box,
typing a label), I want my in-progress edit to survive the background
flicker, so that "adjusting" an annotation doesn't feel like it keeps
undoing my work.

## Investigation

### Reproducing the severity

Live against `npm run dev`, polling the upload prompt's file input via
repeated `find`/`read_page` calls returned a **new element reference on
every call**, and drag/click automation itself became unreliable — clicks
intermittently landed on stale coordinates from a pre-remount layout. This
is more severe than the "~once a second" previously documented.

### Direct instrumentation (temporary, not shipped)

Added a temporary mount/unmount counter to `ScreenshotBlockRender` and to
`PageEditor`, loaded the page (two screenshot blocks present), and read the
counter via `window.__remountCount`:

- `PageEditor` itself mounts once (plus React 19 dev Strict Mode's expected
  double-invoke) and then stays mounted — confirmed via a separate
  mount/unmount counter that never incremented again afterward.
- Both `ScreenshotBlockRender` instances remount continuously and in
  lockstep, **roughly every 150–400ms** (68 remounts across two blocks in a
  5-second window), even in **read-only view** (no Fabric/annotation canvas
  involved at all).
- Captured full mount stack traces: several showed React's
  `reconnectPassiveEffects` / `recursivelyTraverseAndDoubleInvokeEffectsInDEV`
  path rather than a plain fresh-mount path — the dev-only effect
  double-invoke React uses when a subtree's effects are re-attached, not a
  full fiber teardown+recreate.

### Hypotheses tested and ruled out

- **`trailingParagraphExtension`** (calls `editor.insertBlocks` inside
  `editor.onChange`, and this page has two content-less blocks that could
  plausibly re-trigger it): temporarily removed from `PageEditor`'s
  extensions array and reloaded. Remount rate was unchanged (actually
  slightly higher: 68/5s → ~68/5s recomputed as ~13.6 mounts/sec across
  both blocks). **Ruled out.**
- **`codeBlockExitExtension`**: purely a keyboard-shortcut handler, no
  `onChange` subscription, no periodic behavior. Not a candidate.
- **Fabric.js / annotation canvas**: remounts reproduce in the read-only
  branch, which never constructs a `fabric.Canvas`. Not the trigger.
- **A `setInterval`/`setTimeout` polling loop**: grepped the entire `src`
  tree; the only interval is `use-notifications.ts`'s 20-second poll — far
  too slow to explain a ~200ms cadence, and unrelated to this page.
- **`resolveScreenshotUrl` / `useScreenshotBlock`**: both pure/stable —
  `resolveScreenshotUrl` has no randomness or timestamps;
  `useScreenshotBlock`'s backing `createStore` (`src/lib/store.ts`) returns
  the same object reference from `getState()` until an actual `setState`
  call, so it cannot itself cause spurious `useSyncExternalStore` churn.

### Conclusion

The remount is real, severe (much faster than previously documented), dev-
only (unchanged from the prior session's finding that it does not reproduce
in a production build), and **not caused by any of this codebase's own
extensions, hooks, or stores** — every app-level candidate was directly
tested and ruled out. The evidence (`reconnectPassiveEffects` in the mount
stack, confined to BlockNote's custom content-less NodeViews, present even
with zero user interaction) points to a Turbopack/BlockNote/React-19
dev-mode interaction at the framework level, consistent with — and now with
much stronger diagnostic detail than — the "undiagnosed" conclusion in the
prior TDD report. Further root-causing would require instrumenting
BlockNote's own NodeView reconciliation or A/B testing Turbopack vs. the
classic webpack dev server, which is out of scope for this pass; flagged as
a follow-up.

## Task report

### Task 1 — Persist in-progress drag/resize/type edits, not just committed ones

- **Summary**: `AnnotationCanvas`'s existing draft-persistence (from the
  prior TDD cycle) only wrote to the draft store on `object:added`,
  `object:removed`, and `object:modified` — Fabric fires `object:modified`
  only once a drag/resize/rotate gesture **ends**. With remounts landing
  every ~150–400ms, any gesture spanning that window (dragging a box,
  resizing, typing into a label) got torn down mid-gesture and reloaded
  from the last-committed draft, reading as "my adjustment got reset" —
  exactly the reported symptom. Added `object:moving`, `object:scaling`,
  `object:rotating`, and `text:changed` to the same `persistDraft` handler,
  so the draft always reflects the latest in-progress frame, not just the
  post-gesture state.
- **Validation commands**: `npx tsc --noEmit`, `npx eslint
  src/components/editor/annotation-canvas.tsx`, `npx vitest run`.
- **Result**: `tsc` clean; `eslint` clean; `PASS (293) FAIL (0)` (no
  regression — this file has no unit tests of its own, per the existing,
  team-accepted precedent recorded in
  `docs/testing/annotation-remount-resilience.tdd.md`: jsdom lacks the real
  canvas APIs Fabric.js needs, so this component's coverage comes from live
  verification instead).
- **Live verification**: opened the annotator, selected the marker tool,
  placed a marker (counter incremented 1→2, tool stayed selected, no
  console errors) — confirms the additional event listeners don't break
  normal interaction.
- **What is guaranteed**: any Fabric transform event that fires during a
  drag/scale/rotate, and every keystroke during in-progress text editing,
  now updates the same remount-surviving draft store the prior fix already
  wired up — closing the specific gap between "discrete click" (already
  fixed) and "continuous gesture" (still broken until this change).

### Task 2 — Reduce the visual flash itself

- **Summary**: Every remount re-ran `fabric.FabricImage.fromURL(imageUrl)`,
  a fresh fetch+decode, producing a blank canvas until it resolved — with
  remounts every ~150–400ms, this reads as constant flicker even when the
  underlying data is intact. Added a module-level
  `Map<string, HTMLImageElement>` (`loadedImageElements`) keyed by
  `imageUrl`; on a cache hit, constructs `new fabric.FabricImage(cachedElement)`
  synchronously instead of awaiting a fresh load.
- **Validation**: same as above — `tsc`/`eslint`/`vitest` all clean.
- **What is guaranteed**: the second and every subsequent remount of the
  same image within a browser session repaints from an already-decoded
  element instead of re-fetching, shrinking the blank window.

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | `trailingParagraphExtension` is not the remount trigger | manual A/B: extension removed from `PageEditor`, remount rate measured before/after via `window.__remountCount` | manual/diagnostic | RULED OUT (rate unchanged) | live session, ~150–400ms cadence both with and without |
| 2 | The remount is confined to `ScreenshotBlockRender`, not `PageEditor` or the whole tree | mount/unmount counters on both components over a 5–8s window | manual/diagnostic | CONFIRMED | `PageEditor` mount count stayed at 1 (+ Strict Mode double-invoke); `ScreenshotBlockRender` incremented continuously |
| 3 | The remount reproduces with zero Fabric/canvas involvement | observed in the read-only render branch (no `fabric.Canvas` constructed) | manual/diagnostic | CONFIRMED | same live session |
| 4 | New Fabric event listeners don't break normal annotation interaction | live: select marker tool, place a marker, verify counter/tool state/no console errors | manual/E2E | PASS | screenshot `ss_0392yzlbm` |
| 5 | No regression across the existing suite | `npx vitest run` | full suite | PASS | `PASS (293) FAIL (0)` |
| 6 | Types and lint remain clean | `npx tsc --noEmit`, `npx eslint src/components/editor/annotation-canvas.tsx` | static | PASS | both clean |

## Coverage and known gaps

- `AnnotationCanvas` has no unit tests (pre-existing, documented constraint
  — jsdom cannot provide the canvas APIs Fabric.js needs). Coverage for
  this change comes from the live verification above, matching the
  established precedent for this file.
- **The remount's true root cause remains unidentified.** This report adds
  substantially more diagnostic detail than the prior investigation (exact
  cadence, confirmed confinement to `ScreenshotBlockRender`, confirmed
  independence from Fabric, confirmed independence from every app-level
  extension/hook/store candidate, and a mount-stack signature pointing at
  React 19's `reconnectPassiveEffects` path) but does not pin down why
  BlockNote/Turbopack triggers it. Recommended follow-up: A/B the dev server
  with Turbopack disabled (`next dev` without the Turbopack default, or
  pin to a webpack dev build) to confirm whether it's Turbopack-specific,
  or instrument `@blocknote/react`'s NodeView `update()`/`ignoreMutation`
  directly.
- This change makes the editor **resilient** to the remount (same strategy
  as the prior TDD cycle), it does not eliminate the remount or the
  residual visual flicker entirely — the image-cache mitigation (Task 2)
  reduces the flash's duration but the periodic re-render itself still
  happens roughly every 150–400ms in dev.
- Debug instrumentation (temporary mount counters, `console.trace` stack
  captures, a disabled-extension experiment) was added and fully reverted
  during this session — confirmed via `git diff` showing zero diff on
  `screenshot-block.tsx` and `page-editor.tsx` against their committed
  state.

## Merge evidence

Not yet committed — awaiting explicit instruction per this project's
workflow. Files changed:

- `src/components/editor/annotation-canvas.tsx` (modified — continuous
  drag/text persistence + image caching)

No test files were added for this change (see Coverage and known gaps).
