# TDD Evidence Report — Screenshot Upload Survives Dev-Mode NodeView Remount

## Source plan

No `*.plan.md` was provided. Triggered by a user report: "the image media upload
issue in the block has come back — now images can't be uploaded at all,"
via `/ecc:tdd-workflow` with instructions to do E2E testing (Claude in Chrome)
and check Docker health.

## User journey

As an editor writing a page, I want clicking "Pilih berkas" to reliably upload
the image I pick, so that a brief background UI flicker in dev mode doesn't
silently swallow my upload.

## Investigation

### Docker

`minio` + `minio-init` (the actual storage backend for screenshot uploads,
`docker-compose.yml`) are healthy. Two Supabase-CLI-managed containers were
unhealthy (`supabase_edge_runtime_beacon` exited, `supabase_vector_beacon`
crash-looping on a docker-socket connection refusal), but there is no
`supabase/functions` directory and neither container sits on the upload path
(presign → browser PUT to MinIO → Supabase Postgres row) — ruled out as the
cause.

### E2E reproduction (live `npm run dev` session, Claude in Chrome)

A drag-and-drop upload completed correctly end-to-end (presigned POST →
MinIO PUT 200 → `screenshot_blocks` row → page autosave 204, verified
surviving a hard reload) — the S3/MinIO/DB pipeline itself was not broken.

Repeatedly querying the upload prompt's file input (via `find`/`read_page`)
returned a **new element reference on every call, roughly once per second**,
matching a previously-documented, never-root-caused issue in
`screenshot-block.tsx`: BlockNote recreates the screenshot block's NodeView
roughly once a second in `npm run dev` only (confirmed absent from a
production build in a prior session — see
`docs/testing/annotation-remount-resilience.tdd.md`).

**Root cause of the reported regression**: `ScreenshotUploadPrompt`'s
"Pilih berkas" button used a component-local `<input type="file">` (via
`useRef`). Clicking it opens the native OS file-picker dialog, which
realistically takes a user several seconds to complete. With the underlying
block subtree — and the `<input>` inside it — being torn down and recreated
roughly every second by the dev-mode remount, the `<input>` a real user's OS
dialog was bound to was gone by the time they picked a file. The resulting
`change` event fired on an orphaned DOM node with no live React handler,
silently dropping the upload. Drag-and-drop and paste were unaffected because
those complete synchronously, inside a single remount window.

## Task report

### Task 1 — Decouple the file input's identity from the remounting subtree

- **Summary**: Added `src/lib/file-select-singleton.ts` — a single
  `<input type="file">` created once and appended directly to
  `document.body`, entirely outside any React tree (and therefore outside
  whatever BlockNote/Turbopack tears down each remount). `requestImageFile(onSelect)`
  registers a callback and clicks the persistent input; its one `change`
  listener resolves the currently-registered callback and clears it.
  Rewired `ScreenshotUploadPrompt`'s "Pilih berkas" button to call
  `requestImageFile` instead of a local ref+input; removed the now-unused
  `useRef`/local `<input>`. Drag-and-drop and paste handlers were untouched.
- **Validation command**: `npx vitest run src/lib/file-select-singleton.test.tsx`
- **RED**:
  ```
  Failed to resolve import "./file-select-singleton" from
  "src/lib/file-select-singleton.test.tsx". Does the file exist?
  ```
- **GREEN**: `PASS (5) FAIL (0)`
- **What is guaranteed**: exactly one file input is created and reused
  (not duplicated) across repeated requests; it's scoped to images; the
  registered callback fires with the selected file; only the
  most-recently-registered callback fires; and — the direct regression
  test — the input keeps working and still delivers the selected file to
  its callback **after the calling React component unmounts**, simulating
  BlockNote's dev-mode NodeView remount tearing down whatever rendered the
  request.

### Task 2 — Live verification against the actual remount bug

- **Validation**: live Chrome session against `npm run dev`.
- Clicked "Pilih berkas" on a fresh screenshot block; confirmed via
  `document.body.querySelectorAll('input[type="file"]')` that the singleton
  input appeared, tagged it with a marker, waited 5 seconds (spanning
  several observed remount cycles), and confirmed the *same* input node
  (marker intact, count still 1) was still present.
- Delivered a file to that surviving input (`DataTransfer` + `change` event,
  simulating a user finishing the OS dialog after the delay) and confirmed
  the full chain completed: `POST /api/s3/presign` → 200, object persisted
  to MinIO (subsequent `GET` on the new object key → 200), block transitioned
  into the annotator UI (`isAnnotating` true) exactly as a successful upload
  should. This is the exact interaction the pre-fix implementation would
  have dropped.
- Test block and its 1×1 placeholder image were deleted from the page after
  verification (page retains one older, harmless test image from the
  drag-and-drop reproduction earlier in this session — left in place, purely
  cosmetic).

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | Only one file input is ever created, reused across calls | `file-select-singleton.test.tsx:appends exactly one hidden file input to document.body, reused across calls` | unit | PASS | `npx vitest run src/lib/file-select-singleton.test.tsx` |
| 2 | The input is scoped to images | `file-select-singleton.test.tsx:scopes the input to images only` | unit | PASS | same |
| 3 | Selecting a file invokes the registered callback with that file | `file-select-singleton.test.tsx:invokes the registered callback with the selected file when the input changes` | unit | PASS | same |
| 4 | The upload flow survives the calling component unmounting mid-request (the regression itself) | `file-select-singleton.test.tsx:keeps working after the calling React component unmounts...` | unit | PASS | same |
| 5 | Only the most recently registered callback fires | `file-select-singleton.test.tsx:only invokes the most recently registered callback` | unit | PASS | same |
| 6 | Full presign → MinIO → DB chain completes after several seconds of live remount churn | live browser session against `npm run dev` | manual/E2E | PASS | network log: `POST /api/s3/presign` 200, MinIO object GET 200, UI transitioned to annotator |

## Coverage and known gaps

- `file-select-singleton.ts`: fully covered by the 5 unit tests above.
- `npx tsc --noEmit`: clean. `npx eslint` on changed files: clean.
- Full suite: `npx vitest run` → `PASS (293) FAIL (0)`.
- The underlying dev-mode NodeView remount itself remains **undiagnosed** at
  the root (unchanged from the prior session's finding — no `setInterval` at
  a ~1s cadence exists anywhere in the codebase; no repeating HMR reconnect
  messages correlate with it either). This fix makes the upload path
  resilient to it, the same pattern already applied to the annotation
  editor's state in `docs/testing/annotation-remount-resilience.tdd.md`,
  rather than eliminating the remount.
- Two Supabase-CLI containers (`supabase_edge_runtime_beacon`,
  `supabase_vector_beacon`) are unhealthy in this environment. Confirmed
  unrelated to screenshot uploads; left unaddressed as out of scope for this
  report — worth a `supabase stop && supabase start` separately.

## Merge evidence

Not yet committed — awaiting explicit instruction per this project's workflow.
Files changed:

- `src/lib/file-select-singleton.ts` (new)
- `src/lib/file-select-singleton.test.tsx` (new)
- `src/components/editor/screenshot-upload-prompt.tsx` (modified)
