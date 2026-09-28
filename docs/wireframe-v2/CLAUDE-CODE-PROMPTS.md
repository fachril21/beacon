# Claude Code prompts — Beacon wireframe v2

How to use: paste **one prompt per session**, in order. Review the diff and the report before moving to the next stage.
Commit after each stage so any stage can be reverted on its own.

Before you start:

1. Put this whole folder at `docs/wireframe-v2/` in the repo.
2. Export the 8 artboards as PNG into `docs/wireframe-v2/images/` (names in `images/README.md`). Optional but helpful.
3. Create a branch: `git checkout -b ui/wireframe-v2`.

---

## Prompt 0 — Read and plan (no code changes)

```
You are working in the Beacon repo (Next.js App Router, Tailwind 4, shadcn/ui, BlockNote, Supabase).

We are doing a layout overhaul based on a wireframe. Do NOT change any code in this session.

Read, in this order:
1. AGENTS.md, and then the relevant guides in node_modules/next/dist/docs/ (this Next.js version has breaking changes; do not rely on memory).
2. DESIGN.md and src/app/globals.css (tokens).
3. docs/wireframe-v2/WIREFRAME-V2-SPEC.md — this is the source of truth for the work.
4. The images in docs/wireframe-v2/images/ if present, and skim docs/wireframe-v2/source/*.dc.html for exact sizes only (they are static HTML, not components to copy).
5. The files listed in section 8 of the spec, plus docs/testing/annotation-remount-resilience.tdd.md and docs/testing/annotation-box-shape-dot-fix.tdd.md.

Then reply with:
- A short summary of what you understood, in your own words.
- Any place where the spec disagrees with the actual code (wrong file name, wrong assumption, missing hook). Be specific and cite file paths.
- For each stage in section 4 of the spec, the concrete list of files you would touch and the tests most likely to be affected.
- Your top 3 risks and how you would mitigate them.
- Questions on decisions D1–D4 (section 6.1) only if you think a default in the spec is wrong.

Do not start implementing. Do not run destructive commands.
```

---

## Prompt 1 — Tokens + workspace shell

```
Implement Stage 1 of docs/wireframe-v2/WIREFRAME-V2-SPEC.md: token changes (section 1) and the workspace shell (section 3.1). Nothing else.

Rules:
- Follow section 0.2 of the spec strictly (behavior must not change; no changes to src/hooks, src/lib/supabase, supabase/migrations, src/app/api; no new dependencies; no hardcoded hex values).
- Read the Next.js docs in node_modules/next/dist/docs/ before touching layouts.

Scope:
- Update/add the width and height tokens in src/app/globals.css as listed in section 1.
- Rework WorkspaceSidebar per section 3.1: remove the "Umum" block; move "Space baru" to a "+" button next to the SPACE label; turn notifications into a nav row with an unread badge (reuse the existing notification logic); move "Pengaturan Organisasi" and "Keluar" into an account dropdown at the bottom; only the active Space (or the first) is expanded by default; tree rows are 32px tall; lock icon on non-publishable Spaces.
- Keep drag-and-drop reorder, the "+" sub-page button, the "…" delete menu, ⌘K search and the org switcher working exactly as before.

When done:
- Run `npm run lint`, `npx tsc --noEmit`, `npm test`. Fix failures. If you change a test, say why (only structure/class changes are acceptable, never behavior).
- Report: files changed, tests changed and why, what you verified visually and at which viewport widths (1440/1280/390), and anything you could NOT verify. If you cannot run a browser, say so explicitly instead of claiming it looks right.
- Stop after this stage.
```

---

## Prompt 2 — Home + Space page

```
Implement Stage 2 of docs/wireframe-v2/WIREFRAME-V2-SPEC.md: the workspace Home page and the Space page (section 3.2).

Rules: section 0.2 applies. No new hooks in this stage.

Scope:
- Home: greeting, topbar actions, two-column layout ("Lanjutkan menulis" from usePages() sorted by updatedAt; Space grid with a dashed "Space baru" card; "Perlu perhatian" with unpublished-changes count via hasUnpublishedChanges and unread notifications). Do NOT build "Aktivitas tim" or the "low rating" row (decision D2: data does not exist).
- Space page: add src/app/(workspace)/spaces/[spaceId]/layout.tsx that renders the header and tabs (Halaman | Anggota | Pengaturan) and move the existing admin-only role logic there instead of rewriting it. Tabs map to the existing routes. The Halaman tab is a tree-shaped table using flattenPageTree with columns Judul, Status, Penulis, Diubah. Resolve authors once via useUsers(organizationId), never with useUser per row. Hide the "Membantu" column for now (no bulk data source).
- Keep the empty states and the delete flows working.

When done: run lint, tsc, tests; report as in the previous stage (files, tests changed and why, what was verified at which widths, what was not verified). Stop after this stage.
```

---

## Prompt 3 — Editor shell (highest risk, go slowly)

```
Implement Stage 3 of docs/wireframe-v2/WIREFRAME-V2-SPEC.md: the editor topbar, writing column and the tabbed right panel (section 3.3, everything except the step card and screenshot block styling).

Before editing, read src/components/editor/page-editor-toolbar.tsx and src/app/(workspace)/spaces/[spaceId]/pages/[pageId]/page.tsx completely and list every behavior they implement (publish/update/unpublish, disabledReason tooltip, empty-page warning, offline queue, unpublished-changes banner, delete, helpfulness badge, role gating). Every one of them must survive.

Scope:
- One 48px topbar: breadcrumb left; right cluster = save status, comments icon, history icon, panel toggle, status badge, split Publish/Update button with chevron menu. Keep the "You have unpublished changes" banner directly under the topbar (spec 3.3) even though the wireframe omits it.
- Replace the px-80 container with mx-auto w-full max-w-editor-column px-6. Move the helpfulness badge out of the breadcrumb into a meta row under the title, and remove the old footer meta row.
- New component src/components/editor/editor-side-panel.tsx with tabs: Daftar isi | Komentar (n) | Riwayat. Reuse PageToc's logic (extract collectHeadings into src/lib if needed), the existing comments data (usePageComments) and the VersionHistoryPanel content and restore semantics. Panel is open by default at >=1440px and closed below. The "Riwayat Versi" menu item opens the panel on the Riwayat tab.
- If moving per-block comment popovers into the panel is too big for this stage, leave the popover and only list comments in the tab; say so in the report.

Do not touch stepper-block, screenshot-block or any annotation file in this stage.

When done: run lint, tsc, tests; do a manual keyboard check (Tab order in the topbar, Esc, ⌘K); report as before, including a checklist mapping each pre-existing toolbar behavior to where it now lives. Stop after this stage.
```

---

## Prompt 4 — Step card + screenshot block frame

```
Implement Stage 4 of docs/wireframe-v2/WIREFRAME-V2-SPEC.md: step card styling and the screenshot block frame (section 3.3, "Step card" and "Screenshot block" parts).

Important: the wireframe's step card is the EXISTING stepper/step block in src/components/editor/stepper-block.tsx. Do not create a new block type. First find where the numbering and connector-line CSS for stepper actually lives (do not assume globals.css) and read docs/testing/stepper-block.tdd.md and docs/testing/stepper-block-nested-content.tdd.md.

Scope:
- Align step visuals with the spec: numbered circle using the primary-muted tokens, connector line using the border token, title, body, nested screenshot, description.
- Screenshot block (edit and read-only): neutral frame (1px border token, radius-lg) around the image; "Edit anotasi" pill at the top-right on hover (opens the existing annotation flow for now); the image width must clamp to the container width so it never overflows when the right panel is open.
- Do not change annotation behavior or storage.

When done: run lint, tsc, tests; report as before. Stop after this stage.
```

---

## Prompt 5 — Focused annotation mode (no Blur yet)

```
Implement Stage 5 of docs/wireframe-v2/WIREFRAME-V2-SPEC.md: the focused annotation mode (section 3.4), WITHOUT the Blur tool.

Critical constraints:
- Read docs/testing/annotation-remount-resilience.tdd.md, annotation-box-shape-dot-fix.tdd.md, annotation-editing-alignment.tdd.md and annotation-editor-flicker-mitigation.tdd.md first. BlockNote recreates NodeViews repeatedly, so annotation state, "is annotating" and the active tool must stay in stores outside React component state (annotatingBlockIds, annotation-tool-store). Do NOT move any of it into useState.
- Keep the persistence path: patchAnnotationsLocal (immediate) then updateAnnotations (debounced 500ms).
- Do not add the "blur" shape type or expose any Blur UI (decision D1 is unresolved).

Scope:
- A full-screen overlay (portal, using the existing ui/dialog or ui/sheet) opened from the "Edit anotasi" pill. It stores which block is being annotated in a store, not in component state.
- 48px top bar (close, title, save status, Batal, Selesai); 64px left tool rail (Nomor, Panah, Kotak, Label; then Undo, Redo, Delete); floating properties bar (5 colors from SWATCHES, 3 stroke widths, "next number" preview); canvas area; right 320px panel with the object list and the step description field (same data source as today).
- Number tool gesture: click = numbered badge; drag = badge plus arrow to the release point. Deleting a marker renumbers the rest.
- Undo/redo: local snapshot stack of Annotation[] inside the overlay, max 50 steps.
- Keyboard: Delete removes the selected object, Cmd/Ctrl+Z / Shift+Cmd/Ctrl+Z, Esc closes.

When done: run lint, tsc, tests (annotation tests included; update only structure-related assertions and explain each). Manually verify: open/close repeatedly, switch tools, draw all shapes, reload the page, and confirm nothing resets on remount. Report exactly what you verified and what you could not. Stop after this stage.
```

---

## Prompt 6 — Public site (desktop + mobile)

```
Implement Stage 6 of docs/wireframe-v2/WIREFRAME-V2-SPEC.md: the public site (section 3.5) on desktop and mobile.

Rules: section 0.2 applies. Public reads must keep going through the existing anon/RLS-governed hooks. No new hooks in this stage.

Scope:
- Nav 64px. Hide the "Pratinjau developer" organization switcher in production builds (keep it in development). Do not render a "Hubungi dukungan" button (decision D4).
- Public home: centered hero with a large search box that opens PublicSearchCommand, and a row labeled "Terbaru:" using the 4 most recently published page titles available from existing hooks (do NOT call it "Populer"); topic grid from usePublicSpaces. Skip "Panduan terbaru" (needs a new hook; Stage 7).
- Article view: 260px left tree, 720px reading column, 220px right "Di halaman ini" (hidden below 1280px, headings from the published snapshot via the shared collectHeadings); breadcrumb; "Diperbarui {date}" from publishedAt; do NOT show the author name (decision D3); FeedbackWidget restyled only; previous/next cards from flattenPageTree order.
- Mobile: 56px nav with hamburger opening a ui/sheet with the tree; "Di halaman ini" as an accordion; feedback buttons at least 44px tall.
- The "page no longer available" state and "no results" search state must keep working.

When done: run lint, tsc, tests; verify at 1440/1280/390 (or say you could not); check that no internal-only data can appear on public routes. Stop after this stage.
```

---

## Prompt 7 — Optional follow-ups (only after you decide D1–D4)

Run these separately, one at a time, and only if you want them.

### 7a — Blur with burn-in (decision D1)

```
Design first, code second. Decision D1 in docs/wireframe-v2/WIREFRAME-V2-SPEC.md says the Blur annotation must be permanently baked into the image that is published.

Step 1 (no code): read supabase/migrations/20260806100200_publishing_rpcs.sql, src/hooks/use-pages.ts (usePublishActions), src/hooks/use-screenshot-blocks.ts, src/lib/s3/*, and src/app/api/s3/presign/route.ts. Explain how the published snapshot is built today (PublishedContentSnapshot.screenshotBlocks stores imageUrl + annotations) and propose a concrete design where, on Publish/Update, an image with Blur regions flattened into it is rendered client-side, uploaded through the existing presign flow, and referenced by the snapshot instead of the original. Cover: failure handling and offline behavior, what happens when a block is edited after publish, whether the original stays private, cost impact (must stay within the zero-new-cost constraint), and how to test it.
Wait for my approval before writing code.

Step 2 (after approval): implement it, including the "blur" annotation type, the Blur tool in the annotation rail, and tests. The warning text in the annotation panel ("Area blur akan ditanam permanen ke gambar saat halaman dipublikasikan") must only ship once this is actually true.
```

### 7b — Aggregated data for Home/Space/Public

```
Add only the hooks listed in section 6.2 of docs/wireframe-v2/WIREFRAME-V2-SPEC.md that I approve: useSpaceHelpfulness(spaceId), usePublicLatestPages(organizationId, limit). Follow the existing hook patterns (store + mappers, tests next to the hook). Public hooks must only return published pages of publishable Spaces of the resolved Organization and must go through the anon role. Then wire them into the "Membantu" column, the "low rating" attention row and the public "Panduan terbaru" list. Do not weaken or edit RLS policies; if a policy blocks you, stop and explain.
```

---

## Prompt R — Review pass (run after any stage, in a fresh session)

```
Review the uncommitted/last-commit changes on this branch against docs/wireframe-v2/WIREFRAME-V2-SPEC.md, stage {N}.

Check and report:
1. Behavior regressions: for every behavior listed in the spec for this stage, point to the code that still implements it.
2. Rule violations: hardcoded hex, changes to src/hooks, src/lib/supabase, supabase/migrations or src/app/api, new dependencies, useState used for state that must live in the annotation stores.
3. Tests changed: for each changed test, is the change structural only?
4. Accessibility: aria-labels on icon buttons, nav landmarks, focus ring, keyboard paths.
5. Anything in the spec that was skipped or done differently, and why.

Do not modify code. Output a prioritized list of issues (blocking / should fix / nit) with file paths and line references.
```
