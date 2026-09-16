# TDD Evidence — AWS S3 Image Upload (PROJECT.md §9.3 / PRD.md Epic 12)

**Date:** 2026-09-01
**Branch:** development
**Scope:** Re-target the screenshot upload subsystem from the Backblaze-B2-flavored
build to real AWS S3 (virtual-hosted-style, `S3_FORCE_PATH_STYLE=false`); surface
the server-side size-cap rejection and other presign errors to the UI; refresh
`.env.example` and the `src/lib/s3/*` doc-comments.

## Source plan

Inline `/ecc:plan` output approved in-session (no `*.plan.md` file). Plan summary:
this is a **retarget + polish** of an already-built subsystem, not a greenfield
build. The presign route, S3 client, env getters, `buildScreenshotObjectKey`,
`createPresignedUpload`, the client `useUploadScreenshot` flow, `resolveScreenshotUrl`,
and the `screenshot_blocks` persistence (`image_object_key` + `annotation_json`)
already existed and are provider-agnostic.

### Pre-flight

- `.env.local` is gitignored — confirmed via `git check-ignore -v .env.local`
  (matched by `.env*` at `.gitignore:34`; `.env.example` re-included by `!.env.example`).
- `.env.local` already carries a dedicated `# AWS S3 DBB` block with all 8 keys
  (`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
  `S3_FORCE_PATH_STYLE`, `S3_MAX_UPLOAD_BYTES`, `NEXT_PUBLIC_S3_PUBLIC_URL_BASE`),
  placed after the stale Backblaze block so it wins on dotenv last-value-wins.
  No edit to `.env.local` was needed or made. Env values were never printed or logged.

## User journeys

1. **As a User**, when I upload a screenshot, the browser requests a presigned PUT
   from `/api/s3/presign`, uploads the bytes directly to AWS S3, and the resulting
   object key + `annotation_json` are persisted on the `screenshot_blocks` row —
   no file or credential passes through Supabase. *(pre-existing, still green)*
2. **As a User**, when I try to upload an image larger than `S3_MAX_UPLOAD_BYTES`,
   the presign route rejects it **before** issuing a URL and I see a clear
   "image too large" message — not a generic failure, and no phantom DB row.
3. **As a User**, when I try to upload a non-image file, the route rejects it and
   I see a "must be an image" message.
4. **As a developer**, the presign route answers with machine-readable error codes
   (`MISSING_FIELDS` / `INVALID_FILE_TYPE` / `FILE_TOO_LARGE`), matching the
   Organization/Space invite routes' code-not-prose convention, and the browser
   owns the Bahasa Indonesia copy.
5. **As a developer**, `.env.example` and the `src/lib/s3/*` comments describe the
   real target (AWS S3, virtual-hosted-style) so the next contributor configures
   the right thing.

## Task report

### Task A — presign route returns error codes (journeys 2–4)

- **Summary:** replaced the three prose 4xx bodies in `route.ts` with
  `MISSING_FIELDS`, `INVALID_FILE_TYPE`, and `FILE_TOO_LARGE` (+ `maxUploadBytes`);
  `401 Unauthorized` unchanged.
- **RED:** `npx vitest run src/app/api/s3/presign/route.test.ts` —
  `expected { Object (error) } to deeply equal { error: 'MISSING_FIELDS' }` (and
  the INVALID_FILE_TYPE / FILE_TOO_LARGE cases).
- **GREEN:** same command — 5/5 pass.
- **Guarantees:** unauthenticated callers get 401 and no URL is issued; missing
  fields → 400 `MISSING_FIELDS`; non-image → 400 `INVALID_FILE_TYPE`; oversize →
  413 `FILE_TOO_LARGE` + `maxUploadBytes`, `createPresignedUpload` not called;
  happy path calls `buildScreenshotObjectKey(pageId, fileName)` +
  `createPresignedUpload({ bucket, key, contentType })` and returns `{ url, objectKey }`.

### Task B — client surfaces the presign error code (journeys 2–4)

- **Summary:** `useUploadScreenshot` now reads the failed presign response body and
  rethrows `body.error` (falling back to `PRESIGN_FAILED` on an unparseable body);
  the direct-PUT failure throws `UPLOAD_FAILED`.
- **RED:** `npx vitest run src/hooks/use-screenshot-blocks.test.ts` —
  `expected [Function] to throw error including 'FILE_TOO_LARGE' but got 'Failed to get an upload URL'`.
- **GREEN:** same command — all pass, including the new unparseable-body fallback case.
- **Guarantees:** the size-cap (and other presign) rejection reaches the caller as
  its code; no `screenshot_blocks` insert happens on a rejected or failed upload.

### Task C — Bahasa Indonesia message mapping (journey 4)

- **Summary:** new pure `screenshotUploadErrorMessage(error)` in
  `src/lib/s3/upload-error.ts`; `screenshot-block.tsx`'s upload `catch` now calls it.
- **RED:** `npx vitest run src/lib/s3/upload-error.test.ts` — stub returned the
  generic message for every code; `expected '…' to match /terlalu besar/i`.
- **GREEN:** same command — 4/4 pass.
- **Guarantees:** `FILE_TOO_LARGE` → "Gambar terlalu besar…", `INVALID_FILE_TYPE`
  → "Berkas harus berupa gambar…", any other value (including non-`Error`) →
  the generic "silakan coba lagi" retry copy.

### Task D — AWS-shaped env defaults are pinned by test (journey 5)

- **Summary:** new `src/lib/s3/env.test.ts`. No production change — `env.ts`
  already had AWS-friendly defaults; the test locks them and the doc-comments were
  refreshed.
- **RED/GREEN:** characterization tests — green on first run
  (`npx vitest run src/lib/s3/env.test.ts`).
- **Guarantees:** `getS3Endpoint()` is `undefined` when unset (AWS regional default)
  and passes an explicit `https://s3.<region>.amazonaws.com` through; `getS3Region()`
  defaults `us-east-1`; `getS3ForcePathStyle()` is `false` unless the value is
  exactly `"true"`; `getS3MaxUploadBytes()` defaults to 10 MiB and honours a numeric
  override; `getS3Bucket()` / `getS3AccessKeyId()` / `getS3SecretAccessKey()` throw
  by name when unset.

### Task E — docs/config refresh (journey 5, no logic change)

- `.env.example`: object-storage block rewritten for AWS S3 — keys blank,
  `S3_ENDPOINT` blank with the "leave blank for the regional default" note,
  `S3_FORCE_PATH_STYLE=false`, virtual-hosted `NEXT_PUBLIC_S3_PUBLIC_URL_BASE` form,
  plus a CORS reminder.
- `src/lib/s3/env.ts`, `presign.ts`: comments retargeted B2 → AWS; the PUT-vs-POST
  rationale rewritten (AWS *does* support presigned POST — we keep PUT for
  simplicity + emulator parity).
- Reworded the stray "Backblaze B2" strings in `presign.test.ts` and
  `use-screenshot-blocks.test.ts`.

## Test specification

| # | What is guaranteed | Test file / case | Type | Result | Evidence |
|---|--------------------|------------------|------|--------|----------|
| 1 | No auth → 401, no presigned URL issued | `src/app/api/s3/presign/route.test.ts` "returns 401 when there is no authenticated user" | integration | PASS | `vitest run src/app/api/s3/presign/route.test.ts` |
| 2 | Missing field → 400 `MISSING_FIELDS` | route.test.ts "returns 400 MISSING_FIELDS" | integration | PASS (RED→GREEN) | ″ |
| 3 | Non-image → 400 `INVALID_FILE_TYPE` | route.test.ts "returns 400 INVALID_FILE_TYPE" | integration | PASS (RED→GREEN) | ″ |
| 4 | Oversize → 413 `FILE_TOO_LARGE` + `maxUploadBytes`, no URL issued | route.test.ts "returns 413 FILE_TOO_LARGE with the limit" | integration | PASS (RED→GREEN) | ″ |
| 5 | Happy path → presigned PUT scoped to built key, returns `{ url, objectKey }` | route.test.ts "issues a presigned PUT…" | integration | PASS | ″ |
| 6 | Presign rejection reaches the caller as its code, no DB row | `src/hooks/use-screenshot-blocks.test.ts` "rejects with the server's error code…" | unit | PASS (RED→GREEN) | `vitest run src/hooks/use-screenshot-blocks.test.ts` |
| 7 | Unparseable presign error body → `PRESIGN_FAILED`, no DB row | use-screenshot-blocks.test.ts "falls back to PRESIGN_FAILED…" | unit | PASS | ″ |
| 8 | Direct-PUT failure → throws, no DB row | use-screenshot-blocks.test.ts "throws when the S3 upload itself fails" | unit | PASS | ″ |
| 9 | `FILE_TOO_LARGE` → size-specific BI message | `src/lib/s3/upload-error.test.ts` | unit | PASS (RED→GREEN) | `vitest run src/lib/s3/upload-error.test.ts` |
| 10 | `INVALID_FILE_TYPE` → file-type BI message | upload-error.test.ts | unit | PASS (RED→GREEN) | ″ |
| 11 | Unknown code / non-Error → generic retry BI message | upload-error.test.ts | unit | PASS | ″ |
| 12 | AWS-shaped env defaults (endpoint/region/forcePathStyle/maxBytes/required creds) | `src/lib/s3/env.test.ts` | unit | PASS | `vitest run src/lib/s3/env.test.ts` |

## Coverage and known gaps

- Full suite: **385 passing / 0 failing**; `vitest run --coverage` reports
  `"success": true` (global 80% line/branch/function/statement thresholds met).
- Touched files: `src/lib/s3/upload-error.ts` 100%, `src/lib/s3/env.ts` 100%,
  `src/app/api/s3/presign/route.ts` 100% (all four metrics).
- `npx tsc --noEmit` — no errors. `npx eslint …` — no issues. `npx next build` —
  Errors: 0, Warnings: 0.
- **Gap — `screenshot-block.tsx` upload `catch` (one line):** exercised only
  indirectly. The component's upload path needs a real file-drop + `Image.onload`,
  which JSDOM doesn't run, so the existing suite has never unit-tested it. The
  message-mapping logic it delegates to is at 100% via `upload-error.test.ts`.
- **Gap — infra, not code:** the AWS bucket must have a CORS rule allowing `PUT`
  (and `GET`) from the app origin, and the public prefix must allow anonymous
  `GET` (or sit behind CloudFront) for `NEXT_PUBLIC_S3_PUBLIC_URL_BASE` to render.
  Not verifiable in this repo.
- **Not changed on purpose:** the `PUT` upload mechanism (works on AWS), the
  `screenshot_blocks` schema/migration, the docs-proxy route
  (`src/app/api/docs/[...key]`, `src/lib/s3/{doc-key,get-object}.ts`) and its
  remaining B2 comments (separate feature), and `next.config.ts` `images.remotePatterns`
  (every `<Image>` in the screenshot path already sets `unoptimized`, which bypasses
  the remotePatterns check in Next 16.3 — verified in `node_modules/next/dist/shared/lib/get-img-props.js`).

## Merge evidence (RED → GREEN → refactor)

- `test:` commit — 5 reproducers added, RED verified (prose errors / swallowed body
  / stubbed mapper).
- `feat:` commit — route codes + hook rethrow + `screenshotUploadErrorMessage`;
  GREEN verified (55 → 385 passing).
- `refactor:` commit — `.env.example` + `src/lib/s3/*` comments B2 → AWS, extra
  env-credential test, unparseable-body test, this report; suite still green.
