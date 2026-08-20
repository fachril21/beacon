# TDD Evidence: Public Documentation-File Proxy over Backblaze B2

## Source plan

No `*.plan.md` file — produced inline via `/ecc:plan` (conversational mode) in this session, then implemented via `/ecc:tdd-workflow`. Two plans were confirmed in this session:

1. Migrate screenshot storage from MinIO to Backblaze B2 (presigned upload flow: POST → PUT).
2. Add `/api/docs/[...key]`, a public, unauthenticated proxy that streams `docs/` objects out of the (intentionally private) storage bucket, so the bucket itself is never exposed as a direct URL.

This report covers cycle 2 (the docs proxy). Cycle 1's RED/GREEN/refactor commits are on this branch (`test: add reproducer for presigned-PUT S3 upload flow`, `fix: switch screenshot presigned upload from S3 POST to PUT`, `refactor: drop unused @aws-sdk/s3-presigned-post dependency`) and were verified live against the real bucket (presigned PUT smoke test), but predate the formal evidence-report step.

## User journeys

- As an anonymous visitor, I want to `GET /api/docs/<path>` and receive the file bytes with the correct `Content-Type`, so I can view/download documentation without logging in.
- As an anonymous visitor requesting `?download`, I want `Content-Disposition: attachment` instead of `inline`, so the browser saves the file instead of rendering it.
- As an anonymous visitor requesting a path with `..` or a disallowed extension, I want a `400`, so this public route can't be used to reach arbitrary bucket contents (the bucket also holds `screenshots/`).
- As an anonymous visitor requesting a doc that doesn't exist, I want a `404`.
- As a repeat visitor with a cached `ETag`, I want a `304` with no body when the doc hasn't changed, so bandwidth isn't wasted and cache invalidation happens automatically when the object changes.

## Task report

### Task 1: `buildDocObjectKey` — safe key construction

- **Summary**: Restricts the public route to a `docs/` prefix and an extension allowlist, rejecting traversal/unsafe segments, before any S3 call is made.
- **Validated**: `npx vitest run src/lib/s3/doc-key.test.ts`
- **RED**: `Failed to resolve import "./doc-key" from "src/lib/s3/doc-key.test.ts". Does the file exist?` (compile-time RED — module didn't exist yet)
- **GREEN**: `PASS (13) FAIL (0)`
- **Guarantee**: no request can reach an object outside `docs/`, and only `pdf/png/jpg/jpeg/gif/webp/svg` are ever served.

### Task 2: `getDocObject` — GetObject wrapper with streaming + conditional GET

- **Summary**: Wraps `GetObjectCommand`, converts the Node body stream to a web `ReadableStream` (no buffering), and maps B2's 304/NoSuchKey responses to typed outcomes.
- **Validated**: `npx vitest run src/lib/s3/get-object.test.ts`
- **RED**: `Failed to resolve import "./get-object" from "src/lib/s3/get-object.test.ts". Does the file exist?`
- **GREEN**: `PASS (13) FAIL (0)` (combined with Task 1's suite)
- **Guarantee**: large files stream through rather than load fully into memory; a conditional GET that matches returns `{ notModified: true }` instead of re-transferring bytes; a missing key surfaces as `ObjectNotFoundError`, not a generic throw.

### Task 3: `GET /api/docs/[...key]` — the route handler

- **Summary**: Ties the above together: 400 on invalid path (never calls S3), 404 on missing object, 304 on conditional GET, 200 with streamed body + `inline`/`attachment` disposition otherwise.
- **Validated**: `npx vitest run "src/app/api/docs/"`
- **RED**: `Failed to resolve import "./route" from ".../route.test.ts". Does the file exist?`
- **GREEN**: `PASS (6) FAIL (0)`
- **Guarantee**: every branch in the plan (200/304/404/400×2/download toggle) is covered by an isolated unit test with S3 mocked at the `getDocObject` boundary.

### Live verification (real Backblaze B2 bucket, real running dev server)

Beyond the mocked unit tests, seeded a real object (`docs/smoke-test/hello.pdf`) in the actual `beacon-storage` B2 bucket and hit the actual route on the running `next dev` server (not a test double):

```
GET /api/docs/smoke-test/hello.pdf          -> 200, correct Content-Type/ETag/body
GET ... with If-None-Match matching ETag    -> 304
GET /api/docs/smoke-test/hello.pdf?download -> Content-Disposition: attachment
GET /api/docs/smoke-test/does-not-exist.pdf -> 404
GET /api/docs/smoke-test/hello.exe          -> 400
```

Test object deleted afterward; no leftover state in the bucket.

## Test specification

| # | What is guaranteed | Test file | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | Path segments join into `docs/<segments>` | `src/lib/s3/doc-key.test.ts:joins allowed path segments` | unit | PASS | `npx vitest run src/lib/s3/doc-key.test.ts` |
| 2 | Every allowlisted extension is accepted | `doc-key.test.ts:allows every extension on the allowlist` | unit | PASS | same |
| 3 | Empty path is rejected | `doc-key.test.ts:rejects an empty path` | unit | PASS | same |
| 4 | `..` traversal segment is rejected | `doc-key.test.ts:rejects a .. traversal segment` | unit | PASS | same |
| 5 | Embedded path separator is rejected | `doc-key.test.ts:rejects a segment that embeds a path separator` | unit | PASS | same |
| 6 | Disallowed extension is rejected | `doc-key.test.ts:rejects a disallowed file extension` | unit | PASS | same |
| 7 | No-extension filename is rejected | `doc-key.test.ts:rejects a file name with no extension` | unit | PASS | same |
| 8 | Extension matching is case-insensitive | `doc-key.test.ts:is case-insensitive about the extension` | unit | PASS | same |
| 9 | GetObject result exposes a readable web stream + metadata | `src/lib/s3/get-object.test.ts:returns a web ReadableStream plus...` | unit | PASS | `npx vitest run src/lib/s3/get-object.test.ts` |
| 10 | Missing `ContentType` defaults to `application/octet-stream` | `get-object.test.ts:defaults content-type to application/octet-stream` | unit | PASS | same |
| 11 | 304 from B2 maps to `{ notModified: true }` | `get-object.test.ts:returns { notModified: true } when B2 responds 304` | unit | PASS | same |
| 12 | Missing key throws `ObjectNotFoundError` | `get-object.test.ts:throws ObjectNotFoundError when the key doesn't exist` | unit | PASS | same |
| 13 | Unrelated S3 errors propagate, not swallowed | `get-object.test.ts:re-throws unrelated S3 errors` | unit | PASS | same |
| 14 | 200 streams body with correct headers | `src/app/api/docs/[...key]/route.test.ts:streams the object with the content-type, ETag, and inline disposition` | integration | PASS | `npx vitest run "src/app/api/docs/"` |
| 15 | `?download` forces `attachment` disposition | `route.test.ts:sets Content-Disposition: attachment when ?download is present` | integration | PASS | same |
| 16 | Conditional GET returns 304, forwards If-None-Match | `route.test.ts:forwards If-None-Match and returns 304...` | integration | PASS | same |
| 17 | Missing doc returns 404 JSON | `route.test.ts:returns 404 when the document doesn't exist` | integration | PASS | same |
| 18 | Traversal attempt returns 400, never calls S3 | `route.test.ts:returns 400 for a path-traversal attempt...` | integration | PASS | same |
| 19 | Disallowed extension returns 400, never calls S3 | `route.test.ts:returns 400 for a disallowed file extension` | integration | PASS | same |
| 20 | Full live round-trip (200/304/download/404/400) against the real B2 bucket | manual, see "Live verification" above | e2e (manual) | PASS | curl transcript above |

## Coverage and known gaps

`npx vitest run --coverage`:

```
lib/s3             |   97.36 |    96.96 |     100 |   97.29
  get-object.ts     |   92.85 |       90 |     100 |   92.85 | 56
app/api/docs/[...key] |  90.9 |    81.25 |     100 |    90
  route.ts          |    90.9 |    81.25 |     100 |      90 | 22,40
```

All new code clears the project's 80% threshold individually. `get-object.ts:56` (the defensive `if (!response.Body)` branch) is an intentional gap — B2 returning 200 with no body is not something the SDK is expected to do in practice, and simulating it faithfully through the mock would be more contrived than valuable.

Project-wide coverage (`npx vitest run --coverage` totals: 75.39% stmts / 63.9% branch / 72.45% funcs / 79.65% lines) is **below** the repo's global 80% threshold. This is pre-existing debt in unrelated files (e.g. `components/ui/popover.tsx` 14%, `components/editor/screenshot-upload-prompt.tsx` 17%, `lib/mock/generate-content.ts` 41%) not touched in this session — not something introduced by this change. Flagging rather than silently claiming the project-wide gate passes.

## Merge evidence

Three checkpoint commits on `development` for this cycle:
- `test: add reproducer for the public documentation-file proxy route` (RED — compile-time, all three suites failed to resolve their not-yet-created implementation modules)
- `feat: add a public documentation-file proxy route` (GREEN — `doc-key`/`get-object` suites: 13 pass; route suite: 6 pass; full project suite: 331 pass; `tsc --noEmit`: no errors)
- No separate refactor commit was needed — the GREEN implementation was already the minimal, clean version.
