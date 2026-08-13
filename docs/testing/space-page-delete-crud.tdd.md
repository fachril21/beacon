# TDD Evidence Report — Delete CRUD for Spaces and Pages

## Source plan

No `*.plan.md` was provided. User request: "Is there already a feature for managing spaces and pages? I can't delete pages or spaces. Please build out the CRUD for it — just the parts that are needed. If Update isn't needed, no need to force-build it, that's fine."

## Scoping research

A research pass (whole-codebase inventory) established the actual gap before any code was written:

- **Create, Read, and Update** already exist and are fully wired for both Space and Page (`useCreateSpace`/`useCreatePage`, `useSpaces`/`usePages`/`useChildPages`, `useUpdateSpaceRole`/`useUpdatePageTitle`/`useUpdatePageContent`/`useReorderPages`/`usePublishActions`). Space has no "rename the Space itself" hook, but the user only asked about Delete, so per their own instruction ("if Update isn't needed, no need to force-build it") that gap was left alone.
- **Delete did not exist at all** for either entity — no hook, no API route, no RLS `DELETE` policy on `spaces` or `pages` (confirmed by reading every migration file), no UI button, menu item, or context menu anywhere in the sidebar tree. This is the entire scope of this round of work.

## User journeys

1. As a Space admin, I want to delete a Space I no longer need, and have everything inside it (Pages, screenshots, permissions) go with it.
2. As a Page editor or admin, I want to delete a Page (and, if it has sub-pages, the whole subtree) from the sidebar without having to open it first.
3. As a Page editor or admin, I want to delete the Page I'm currently editing, from the same overflow menu I already use for other page-level actions.
4. As a Viewer (no admin/editor permission), I should never see a delete option I can't use — RLS already rejects the write; the UI should hide the dead-click affordance too, matching this codebase's existing role-gating convention (US17.2).

## Task report

| Task | Summary | Validation | Result |
|---|---|---|---|
| Add DELETE RLS policies | `supabase/migrations/20260812020000_delete_policies.sql` — `spaces_delete_admin_only` (mirrors `spaces_update_admin_only`) and `pages_delete_editor` (mirrors `pages_update_editor`). Neither table had a DELETE policy before, so any client `.delete()` call was previously silently filtered to 0 rows by RLS's default-deny | Queried `pg_policies` on the live DB before and after via `supabase db query` — confirmed 0 → 2 DELETE policies | Applied to the live self-hosted Supabase instance (user explicitly approved this step) |
| RED: `useDeletePage` | Added 3 failing tests to `use-pages.test.ts` (delete + store removal, recursive descendant removal mirroring the DB's `on delete cascade`, error path leaves store untouched) | `npx vitest run src/hooks/use-pages.test.ts` | FAIL — `useDeletePage is not a function` (3 new failures, 7 pre-existing tests still passing) |
| GREEN: `useDeletePage` | Implemented in `use-pages.ts` — deletes the row, then walks the local `parentPageId` tree to drop the deleted page and every descendant from `pagesStore` | `npx vitest run src/hooks/use-pages.test.ts` | PASS — 10/10 |
| RED: `useDeleteSpace` | Added 2 failing tests to `use-spaces.test.ts` (delete + removal from `spacesStore`/`pagesStore`/`permissionsStore`/`pendingInvitesStore`, error path untouched) | `npx vitest run src/hooks/use-spaces.test.ts` | FAIL — `useDeleteSpace is not a function` (2 new failures, 4 pre-existing tests still passing) |
| GREEN: `useDeleteSpace` | Implemented in `use-spaces.ts` — deletes the row, then filters everything scoped to that `spaceId` out of the three dependent stores | `npx vitest run src/hooks/use-spaces.test.ts` | PASS — 6/6 |
| Reusable confirm dialog | `src/components/workspace/delete-confirm-dialog.tsx` — a thin wrapper around the existing `Dialog` primitive + `destructive` `Button` variant (no dedicated `AlertDialog` component existed in the codebase). 6 tests covering render, confirm, cancel, busy state, custom label, closed state | `npx vitest run src/components/workspace/delete-confirm-dialog.test.tsx` | PASS — 6/6 (implemented alongside its test rather than strict RED-first — noted here rather than glossed over, since it's a 40-line presentational primitive with no branching logic) |
| Wire Page delete — sidebar | `page-tree-item.tsx`: a "⋯" menu (same hover-reveal pattern as the existing "+" add-sub-page button) appears only for editor/admin (`useSpaceRole`), opens the shared confirm dialog, calls `useDeletePage`, and redirects to the Space root only if the deleted page was the one currently open | `npx vitest run src/components/workspace/page-tree-item.test.tsx` | PASS — 4/4 |
| Wire Page delete — editor toolbar | `page-editor-toolbar.tsx`: added "Hapus Halaman" to the existing "Menu lainnya" overflow menu (same menu that already has "Riwayat Versi" / "Batalkan Publikasi"), editor/admin-gated, redirects to the Space on success | `npx vitest run src/components/editor/page-editor-toolbar.test.tsx` | PASS — 11/11 (8 pre-existing + 3 new) |
| Wire Space delete — home grid | `space-card.tsx`: admin-only "⋯" menu overlaid on the card (click on the trigger stops propagation so it doesn't also navigate the wrapping `Link`) | `npx vitest run src/components/workspace/space-card.test.tsx` | PASS — 3/3 |
| Wire Space delete — Space page | `spaces/[spaceId]/page.tsx`: admin-only "Hapus Space" button next to the existing "Anggota" button, redirects home on success | No automated test — see Coverage/known gaps | Verified live instead |
| Regression check | Full project suite + typecheck + lint on every touched file | `npx vitest run`, `npx tsc --noEmit`, `npx eslint <touched files>` | PASS — 189/189 tests, 0 type errors, 0 lint issues in touched files |
| Live verification | Created a disposable "ZZ Delete Test Space" against the real, running app + live Supabase instance. (1) Deleted a leaf Page via the sidebar "⋯" menu — confirm dialog, toast, page disappeared, redirected to Space root. (2) Created a Page with one sub-page, deleted the parent via the editor toolbar's overflow menu — both parent and child disappeared from the sidebar (DB cascade + client-side store cascade both verified). (3) Deleted the whole test Space via its home-grid card menu — confirm dialog showed the interpolated Space name, toast, card disappeared from the grid and sidebar, redirected home | Manual, Chrome automation against the running `dev` server and the live (migrated) database | All three delete paths work end-to-end; zero impact on the user's real Spaces/Pages |

## What is guaranteed by the passing tests

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | Deleting a Page removes it from the local store | `use-pages.test.ts:useDeletePage deletes the row in Supabase and removes it from the local store` | unit | PASS |
| 2 | Deleting a Page also removes every descendant Page from the local store, mirroring the DB's `on delete cascade` | `use-pages.test.ts:useDeletePage also removes descendant pages...` | unit | PASS |
| 3 | A failed Page delete throws and leaves the local store untouched | `use-pages.test.ts:useDeletePage throws when Supabase returns an error...` | unit | PASS |
| 4 | Deleting a Space removes it, and everything scoped to it (Pages, Permissions, PendingInvites), from local stores | `use-spaces.test.ts:useDeleteSpace deletes the row and removes...` | unit | PASS |
| 5 | A failed Space delete throws and leaves the local store untouched | `use-spaces.test.ts:useDeleteSpace throws when Supabase returns an error...` | unit | PASS |
| 6 | The sidebar's Page delete menu is hidden entirely for a non-editor/admin | `page-tree-item.test.tsx:hides the menu entirely for a viewer` | unit | PASS |
| 7 | Deleting a Page from the sidebar that is *not* the currently open Page does not navigate away | `page-tree-item.test.tsx:deletes the page on confirm and does not navigate away...` | unit | PASS |
| 8 | Deleting the currently-open Page from the sidebar redirects to the Space | `page-tree-item.test.tsx:redirects to the Space when the deleted page is the one currently open` | unit | PASS |
| 9 | The editor toolbar's "Hapus Halaman" is hidden for a viewer | `page-editor-toolbar.test.tsx:hides Hapus Halaman in the overflow menu for a viewer` | unit | PASS |
| 10 | Confirming delete from the editor toolbar calls `useDeletePage` and redirects to the Space | `page-editor-toolbar.test.tsx:deletes the page and redirects to the Space on confirm` | unit | PASS |
| 11 | The Space-card delete menu is hidden for a non-admin | `space-card.test.tsx:hides the Space menu for a non-admin` | unit | PASS |
| 12 | Confirming delete from a Space card calls `useDeleteSpace` | `space-card.test.tsx:deletes the Space on confirm` | unit | PASS |

## Coverage and known gaps

Full project suite: `npx vitest run` → **189/189 passing**. `npx tsc --noEmit` → 0 errors. `npx eslint` on every touched file → 0 issues (3 pre-existing lint issues remain in untouched files — `block-navigation.js`, `src/hooks/use-mobile.ts`, `src/lib/supabase/env.test.ts` — confirmed via `git status` these were not touched by this change).

- **No automated test for `spaces/[spaceId]/page.tsx`'s delete button.** This codebase has zero test precedent for any Next.js App Router `page.tsx` file (confirmed by search — every other route file is untested), and this particular page uses React 19's `use(params)` on a fresh `Promise` each render, which suspends indefinitely under React Testing Library + jsdom without a resolution path RTL can observe (tried wrapping in `<Suspense>`; still rendered nothing). Rather than fight that infrastructure gap for a thin wiring layer that's already covered by the identical, working pattern in `space-card.test.tsx` (same admin-gating, same `DeleteConfirmDialog`, same `useDeleteSpace` call), this path was verified live instead (see live verification row above).
- **`DeleteConfirmDialog` was implemented alongside its test**, not strictly RED-first, called out explicitly rather than silently claimed as RED-first — it's a 40-line presentational component with no conditional logic beyond prop pass-through, and its 6 tests exercise every prop/branch.
- **Space rename/update-own-fields was not built** — the user explicitly said not to force it, and no rename UI or hook existed before this change either.

## Merge evidence

No checkpoint commits were created — per the operator's standing instruction ("only create commits when the user explicitly asks"). This report, together with `git status`/`git diff`, is the durable record of this round's scoping → RED → GREEN → live-verification sequence. The DB migration (`supabase/migrations/20260812020000_delete_policies.sql`) has already been applied to the live self-hosted Supabase instance with the user's explicit approval.
