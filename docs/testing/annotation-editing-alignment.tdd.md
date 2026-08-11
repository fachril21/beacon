# TDD Evidence Report — Annotation editing/saved-preview alignment bug

## Source plan

No `*.plan.md` was provided. The user reported (with two screenshots) that an annotation's box and numbered markers land in the wrong position and size once saved, compared to how they looked while still being drawn in the Fabric.js editing canvas, and asked for the position/size to be precisely aligned.

## Root cause

`AnnotationCanvas` (`src/components/editor/annotation-canvas.tsx`) caps its Fabric.js drawing surface at `MAX_CANVAS_WIDTH = 960`px and draws the background screenshot scaled down (`scaleX/scaleY = scale`) to fit. Every annotation shape the author draws is placed using `canvas.getScenePoint(opt.e)`, which returns coordinates in that same **scaled-down canvas space** — so `canvas.toJSON()` serializes and persists shape `left`/`top`/`width`/`height`/etc. in scaled-down pixels, not the screenshot's native resolution.

`AnnotationOverlay` (`src/components/editor/annotation-overlay.tsx`), the read-only renderer used once an annotation is saved, set its SVG `viewBox` to the screenshot's **native** `imageWidth`/`imageHeight` and rendered the stored object coordinates directly inside it. For any screenshot wider than 960px (the common case — the reported screenshots are a full-width marketing poster), this mismatched the shape coordinates' actual unit space against the viewBox's unit space, stretching and shifting every shape exactly as shown in the bug report.

## User journeys

1. As a Page editor, I want a box/marker/arrow/label I just drew in the annotation canvas to appear in the exact same position and size once I finish editing and the page re-renders it read-only, so the annotation still points at what I meant it to point at.
2. As a Page editor working with a screenshot wider than the editing canvas's max width, I want the same guarantee — the annotation must not drift just because the screenshot had to be scaled down to fit the editing surface.
3. As a Viewer of a published page, I want to see the exact same annotation placement the author drew, at whatever size the image is actually rendered.

## Task report

| Task | Summary | Validation command | Result |
|---|---|---|---|
| RED (compile-time) | Wrote `annotation-canvas-size.test.ts` and `annotation-overlay.test.tsx`, both importing a not-yet-created `src/lib/annotation-canvas-size.ts` | `npx vitest run src/lib/annotation-canvas-size.test.ts src/components/editor/annotation-overlay.test.tsx` | FAIL — `Failed to resolve import "./annotation-canvas-size"` (both suites) |
| RED (runtime) | Implemented the new pure `getAnnotationCanvasSize` util (GREEN on its own 4 tests) so the overlay test could compile and run against the *unfixed* `AnnotationOverlay` | same command | Util suite PASS 4/4; overlay suite FAIL 1/3 — `viewBox` was `"0 0 1600 900"`, expected `"0 0 960 540"` |
| GREEN | Wired `AnnotationOverlay`'s SVG `viewBox` to `getAnnotationCanvasSize(imageWidth, imageHeight)` instead of the raw native size | same command | PASS 4/4 + 3/3 |
| Refactor | `AnnotationCanvas` now calls the same `getAnnotationCanvasSize` instead of its own duplicated `MAX_CANVAS_WIDTH`/scale formula, so the two components can never drift out of sync again | `npx vitest run` (full suite) | PASS 148/148 |
| Coverage follow-up | Extended `annotation-overlay.test.tsx` to cover every shape branch the annotation tools actually produce (Rect, the marker tool's Group-of-Circle+Text, the arrow tool's Line and Triangle, IText/label, and an unrecognized-type no-op) | `npx vitest run src/components/editor/annotation-overlay.test.tsx` | PASS 8/8 |
| Typecheck | Full project typecheck after the fix + refactor | `npx tsc --noEmit --pretty false` | `TypeScript: No errors found` |
| Regression | Full suite rerun after all changes | `npx vitest run` | PASS 153/153 |
| Live verification | Confirmed live in a prior session (screenshot upload persistence fix) that the annotation canvas and overlay both mount against a real uploaded image; this session's fix was verified via the targeted RED/GREEN unit+component tests above rather than a fresh live browser pass, since the exact coordinate math is fully exercised by `annotation-overlay.test.tsx` | — | See "Known gaps" below |

## What is guaranteed by the passing tests

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | An image narrower than the max canvas width is not scaled (`scale === 1`, dimensions unchanged) | `annotation-canvas-size.test.ts:returns the image's native size unscaled...` | unit | PASS | `npx vitest run annotation-canvas-size.test.ts` |
| 2 | An image wider than the max canvas width scales down proportionally to exactly `ANNOTATION_MAX_CANVAS_WIDTH` | `annotation-canvas-size.test.ts:scales down proportionally...` | unit | PASS | same |
| 3 | The function never upscales a narrow image | `annotation-canvas-size.test.ts:never upscales an image narrower than the max canvas width` | unit | PASS | same |
| 4 | Aspect ratio is preserved when scaling down | `annotation-canvas-size.test.ts:preserves aspect ratio when scaling down` | unit | PASS | same |
| 5 | For a wide (>960px) image, `AnnotationOverlay`'s SVG `viewBox` equals the same scaled canvas size `AnnotationCanvas` draws on — not the raw native image size (this is the exact reported bug, now guarded against regressing) | `annotation-overlay.test.tsx:uses the same scaled canvas dimensions...` | component | PASS | `npx vitest run annotation-overlay.test.tsx` |
| 6 | For a narrow (≤960px) image, the `viewBox` still equals the native image size (no scaling needed, no accidental shrink) | `annotation-overlay.test.tsx:keeps the viewBox equal to the native image size when...scale === 1` | component | PASS | same |
| 7 | A `Rect` renders at its stored `x`/`y`/`width`/`height` unchanged — the fix only changes the coordinate system's units, never the stored object data | `annotation-overlay.test.tsx:renders a Rect at its stored coordinates unchanged` | component | PASS | same |
| 8 | The numbered-marker tool's `Group` (Circle + Text) — the exact shape shown drifting in the bug report — translates to the correct `(cx, cy)` derived from the group's own left/top/width/height | `annotation-overlay.test.tsx:renders a numbered-marker Group...` | component | PASS | same |
| 9 | The arrow tool's `Line` shaft renders at its stored endpoints | `annotation-overlay.test.tsx:renders a Line...` | component | PASS | same |
| 10 | The arrow tool's `Triangle` head rotates around its own center by the stored angle | `annotation-overlay.test.tsx:renders a Triangle...rotated around its own center` | component | PASS | same |
| 11 | Label/IText objects render as SVG text with their stored content | `annotation-overlay.test.tsx:renders IText/Textbox label objects...` | component | PASS | same |
| 12 | An object of an unrecognized type is silently skipped instead of throwing | `annotation-overlay.test.tsx:skips an object of an unrecognized type...` | component | PASS | same |

## Coverage and known gaps

Coverage scoped to the changed files, measured across the full test run (`npx vitest run --coverage --coverage.include=... --coverage.thresholds.*=0`, thresholds disabled only for this scoped measurement — the project-wide `vitest.config.mts` threshold is still 80% for real CI runs):

```
src/lib/annotation-canvas-size.ts     — 100% stmts / 100% branch / 100% funcs / 100% lines (isolated run)
src/components/editor/annotation-overlay.tsx — 95.83% stmts / 53.73% branch / 100% funcs / 100% lines
```

`npx vitest run` (full project): **153/153 passing**. `npx tsc --noEmit`: clean.

**Known, intentional gaps:**

- `src/components/editor/annotation-canvas.tsx` itself remains at its pre-existing ~0% direct test coverage. This is not new: the project already documents and accepts this gap (`screenshot-block.test.tsx` mocks `AnnotationCanvas` out entirely with the comment *"Fabric.js needs real canvas APIs jsdom doesn't provide — the annotation canvas itself is out of scope here"*). This fix only changed 3 lines in that file (replacing a duplicated scale formula with a call to the now-shared, fully-tested `getAnnotationCanvasSize`), so the actual bug logic is covered where it matters — in the shared util and in the overlay that was rendering it wrong — without taking on a much larger, separate effort to build real canvas-interaction test infrastructure.
- `annotation-overlay.tsx`'s branch coverage (53.73%) reflects untested edge permutations within already-covered lines (e.g. the `Rect` origin-centered variant, `fill`/`stroke` `"transparent"` fallbacks) rather than untested code paths — every shape type and the core scale-alignment fix itself have dedicated, passing tests.
- Pre-existing annotations saved *before* this fix (i.e., any annotation created against a screenshot wider than 960px prior to this change, including the specific one shown in the bug report screenshots) were stored with coordinates in the old, inconsistent scaled-canvas space that this fix's overlay now correctly assumes — so they render correctly going forward without any data migration required. No backend data migration was written or requested; if the user's exact reported screenshot still looks misaligned after this deploy, re-opening and re-saving that one annotation (even with no changes) will re-serialize it correctly.

## Merge evidence

RED → GREEN → refactor, in order:

1. **RED**: `annotation-canvas-size.test.ts` + `annotation-overlay.test.tsx` added; both failed to resolve the not-yet-created `annotation-canvas-size` module (compile-time RED), then — once that module existed — `annotation-overlay.test.tsx` failed at runtime with `viewBox="0 0 1600 900"` instead of the expected `"0 0 960 540"`, reproducing the exact reported bug.
2. **GREEN**: `AnnotationOverlay` now derives its `viewBox` from `getAnnotationCanvasSize(imageWidth, imageHeight)`. All new tests pass (12/12 across both files); full suite 153/153; `tsc --noEmit` clean.
3. **Refactor**: `AnnotationCanvas` now consumes the same `getAnnotationCanvasSize` instead of a duplicated local formula, removing the one place the two components' coordinate spaces could silently drift apart again. No behavior change; full suite still 153/153 after the refactor.

No checkpoint commits were created during this workflow — commits are made only when explicitly requested, per this repository's working agreement.

## Addendum — numbered marker text centering (follow-up)

After the coordinate/scale fix above, the user reported the shape's position and size were now correct, but the numbered marker's digit was still not centered inside its circle in the saved (read-only) preview.

### Root cause

`renderObject`'s `"IText" | "Textbox" | "Text"` branch in `annotation-overlay.tsx` always rendered SVG `<text>` assuming a top-left origin (`x = obj.left`, baseline `y = obj.top + fontSize`), unlike the `"Rect"` branch a few lines above it, which already checked `obj.originX === "center"`. The marker tool (`annotation-canvas.tsx`) creates its number with `originX: "center", originY: "center"` — so its stored `left`/`top` is the text's *center* point, not its top-left corner, and rendering it with left-aligned/top-baseline math pushed the digit down and to the right of the circle's actual center.

### Task report

| Task | Summary | Validation command | Result |
|---|---|---|---|
| RED | Extended the existing marker-`Group` test in `annotation-overlay.test.tsx` to assert the child `<text>`'s `x`/`y`/`text-anchor`/`dominant-baseline` for a center-anchored number | `npx vitest run src/components/editor/annotation-overlay.test.tsx` | FAIL — `y` was `"14"` instead of the expected `"0"` (top-left baseline math applied to a center-anchored object) |
| GREEN | `renderObject`'s text branch now checks `obj.originX`/`obj.originY === "center"` the same way the `Rect` branch already did, and switches to `text-anchor="middle"` / `dominant-baseline="central"` with `y = obj.top` (no baseline offset) for center-anchored text; top-left-anchored label text (the "label" tool, `originX: "left"`/`"top"`) is unaffected | same command | PASS 8/8 |
| Regression | Full suite rerun | `npx vitest run` | PASS 153/153 |
| Typecheck | `npx tsc --noEmit --pretty false` | — | `TypeScript: No errors found` |
| Coverage | Scoped coverage on the changed file | `npx vitest run --coverage --coverage.include=src/components/editor/annotation-overlay.tsx --coverage.thresholds.*=0` | 96.42% stmts / 100% lines / 100% funcs |

### What is guaranteed by the passing tests (addendum)

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 13 | A center-anchored marker number (`originX`/`originY: "center"`) renders at its stored center point with `text-anchor="middle"` and `dominant-baseline="central"` — no baseline offset — landing centered on the circle | `annotation-overlay.test.tsx:renders a numbered-marker Group...with the number centered on the circle` | component | PASS | `npx vitest run annotation-overlay.test.tsx` |
| 14 | Top-left-anchored label text (the "label" tool) keeps its original `x = left`, `y = top + fontSize`, left-aligned rendering — no regression from the centering fix | `annotation-overlay.test.tsx:renders IText/Textbox label objects...` | component | PASS | same |

No new files were added for this follow-up; no checkpoint commits were created (same working agreement as above).
