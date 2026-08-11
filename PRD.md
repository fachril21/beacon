# Beacon — Product Requirements Document

**Product:** Beacon (internal documentation platform for Dibimbing)
**Positioning:** A GitBook/Notion-like documentation tool purpose-built for fast, visual, screenshot-driven guideline authoring — usable both as an internal knowledge base and as a public help center for Dibimbing's product users.
**Version:** 3.1
**Date:** 2026-08-06
**Status:** Reviewed for completeness — Stage 1 now covers every user-facing flow (Permissions, Comments, Version History added as Epics 8b–8d); Organization schema/RLS added to Epic 9; stale "not yet decided" hosting language removed

---

## 1. Vision

Dibimbing runs multiple platforms, and every one of them needs guidelines — but today those guidelines live scattered across Google Docs, Slack threads, and personal notes, and producing anything with annotated screenshots means round-tripping through Figma or Photoshop. Beacon fixes this by making **the screenshot-annotate-describe loop a first-class, single-editor experience**, not an afterthought bolted onto a generic doc tool.

**The unifying principle: one block type — Screenshot + Annotation + Description — is the atomic unit the entire authoring experience is optimized around.** Everything else (editor, structure, publishing) exists to get a User from "I need to explain this feature" to "a Viewer understands it" in under five minutes.

Beacon serves two audiences from the same content: internal Users who author and maintain guidelines, and public Viewers — Dibimbing's own product users — who read the published result as a help center. The benchmark experience is GitBook for structure and reading, and Notion for the feel of writing.

**A second principle governs how this document is used in build order:** because the project currently starts design-led (UI/UX-driven, no engineering team actively wiring a backend yet), Beacon is built **UI first, integration second** — every Stage 1 epic in Section 9 produces real, usable UI against typed mock data before any Supabase schema or S3 wiring exists. Section 8 (User Flows) exists specifically so that UI can be sliced screen-by-screen against a shared, unambiguous map of every interaction — including for an AI coding agent building components without a human re-explaining the flow each time.

## 2. Goals and Success Metrics

**Product goals:**
- Make Beacon the single source of truth for guidelines across all Dibimbing platforms.
- Make authoring visual guidelines dramatically faster than the current manual, tool-hopping process.
- Give Dibimbing's end users a public, self-serve help center maintained directly by the teams who build the product.
- Serve every business line under Dibimbing Group (Dibimbing, Cakrawala University, and any future additions) from one platform, each with its own independently-branded public domain.
- Keep the entire stack free/open-source or already-owned infrastructure, per the cost constraint locked in PROJECT.md — no new recurring SaaS bill.
- Ship the project as a **single frontend repository** that a UI/UX designer can run and iterate on with one command, with backend integration added without reworking the UI.

**Success metrics (measured in the first 90 days after each respective launch):**
| Metric | Target | Window |
|---|---|---|
| Average time to create one guideline page | < 5 minutes | 90 days post internal launch |
| Active guidelines published internally | ≥ 50 pages | 90 days post internal launch |
| Internal weekly adoption (product, ops, CS, engineering) | ≥ 70% of these teams create/edit ≥ 1 page/week | 90 days post internal launch |
| Internal search success rate (click-through on a search) | ≥ 80% | 90 days post internal launch |
| Public site — pages published | ≥ 20 pages live | 30 days post public launch |
| Public site — helpfulness rate ("Was this helpful?" = Yes) | ≥ 75% | 90 days post public launch |
| Public site — page views | ≥ 1,000 views | 90 days post public launch |

## 3. Target Users

- **User (primary)** — a Dibimbing internal team member with a Beacon account who authors, edits, and publishes documentation. Job-to-be-done: turn "how this feature works" into a guideline, visually, in minutes, and decide unilaterally when it's ready for the public.
- **Viewer (primary, public)** — a Dibimbing product end user reading published guidelines with no account needed. Job-to-be-done: quickly self-serve an answer to "how do I do X in the Dibimbing app" without contacting support.
- **New hire (secondary, internal)** — a new Dibimbing team member using Beacon's internal-only content as an onboarding reference.

## 4. Product Principles

1. **Speed to write** — blank page to published screenshot-annotated guideline in under 5 minutes.
2. **Zero context-switch** — screenshotting, annotating, and writing all happen inside one editor; no Figma/Photoshop round-trip.
3. **Reliability first** — a User must never lose writing to a failed save or crash; this is non-negotiable, not best-effort.
4. **Publish is a deliberate act, never an accident** — content is internal-only by default; nothing reaches Viewers without an explicit, author-initiated Publish action, enforced by the database (RLS), not just the UI.
5. **No gatekeeping between User and public** — the author who owns a page is trusted to publish it directly; Beacon optimizes for speed of publishing and speed of fixing (via Update/Unpublish/Feedback), not for pre-publication review overhead.
6. **One repo, one command** — the entire project lives in a single Next.js frontend directory. Running it locally never requires separately starting, configuring, or holding credentials for a backend service.
7. **Mock data mirrors real data** — UI built during the design-led phase uses typed mock fixtures that match the real Supabase schema exactly, so integration is a plumbing swap, not a rebuild.

## 5. Feature Specs

### 5.1 Rich Text Editor
- **Mechanic:** block-based editing (BlockNote core) — headings, paragraphs, lists, checklists, code blocks, quotes, tables, dividers, plus a slash (`/`) command menu for block insertion.
- **Truth source:** BlockNote's `Block[]` document tree, serialized to JSON and persisted per Page (to a mock in-memory/localStorage store in Stage 1, to Supabase in Stage 2).
- **Reliability logic:** debounce autosave (fires ≤3s after last keystroke); local IndexedDB buffer as a fallback so edits survive offline/crash scenarios and sync automatically on reconnect once wired to Supabase.
- **Content requirements:** must correctly convert pasted content from Word/Google Docs into native blocks (not raw HTML dumps).

### 5.2 Screenshot & Annotation
- **Mechanic:** upload (drag-drop / clipboard paste / file picker) → annotate on a Fabric.js canvas (box, arrow, numbered marker, text label, blur/redact) → attach a text description — all inside a single "Screenshot Block."
- **Truth source:** annotation state stored as a separate `annotation_json` layer referencing (not duplicating) the original image, so re-editing never requires re-upload. In Stage 1, the "original image" is held as a local object URL / mock reference; in Stage 2, it's an S3 (prod) / MinIO (dev) object key obtained via the presigned-URL flow (Section 8, Flow 3; Section 9, Epic 10).
- **Feedback/reveal:** annotated screenshot renders identically for the author (edit mode) and for readers (view mode), with edit affordances hidden in view mode.

### 5.3 Public Publishing
- **Mechanic:** per-Space "publishable" flag (default: internal-only) → per-Page Publish/Update/Unpublish actions, author-initiated, no approval gate.
- **Truth source:** `visibility` + `is_published` fields checked server-side via Postgres RLS on every public read (page render, public search) — identical policy enforced in both places so there is exactly one place the rule can break.
- **Feedback/reveal:** Viewers always see the last **published snapshot**, decoupled from the author's live draft, until the author clicks Update.

### 5.3a Multi-Domain Publishing
- **Mechanic:** a new **Organization** grouping sits above Space — each Organization has a name and one custom domain (e.g. "Dibimbing" → `docs.dibimbing.id`, "Cakrawala University" → `docs.cakrawala.ac.id`). Every Space belongs to exactly one Organization (inherited from its creator). Every User belongs to exactly one Organization, with an `owner` or `member` role.
- **Truth source:** implemented via **Vercel for Platforms** — a Next.js Middleware function resolves the incoming request's `Host` header to an `Organization` row on every request, then scopes all rendering and search queries to that Organization's Spaces — layered on top of, not replacing, the existing `visibility`/`is_published` RLS filter. Domain registration and SSL are handled by Vercel's Domains API when an Organization owner adds a domain in-app.
- **Feedback/reveal:** the same Beacon deployment serves two (or more) visually and structurally separate public sites; content never crosses between them. A domain not mapped to a verified Organization returns a generic "not configured" response, never a fallback to real content.

### 5.4 Feedback Mechanism
- **Mechanic:** "Was this helpful?" Yes/No + optional free-text comment on every published page, no account required.
- **Truth source:** `Feedback` records aggregated into a per-page helpfulness rate (Yes / (Yes+No)), visible to the page's author.

### 5.5 Search
- **Mechanic:** full-text search over Page/Block content, exposed via two RLS-governed Supabase client queries (internal, authenticated + permission-scoped; public, anonymous + published-only) sharing one underlying index but never one code path.
- **Truth source:** Postgres full-text search (native to self-hosted Supabase), same visibility filter as public page rendering, enforced by RLS.

## 6. Architecture and Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js (App Router) | Only piece of "server logic" needed — S3 presigned URL generation — lives as a co-located API route, keeping the whole project one repo, one `npm run dev` command (Principle 6). |
| Backend / Database / Auth / API | Supabase, self-hosted on the company's existing VPS | Auto-generated REST/GraphQL API + Auth + Edge Functions, removing the need for a custom API server entirely. |
| Access control | Postgres Row Level Security (RLS) | Single source of truth for every permission and visibility rule (viewer/editor/admin, internal-vs-public) — enforced at the database layer, not duplicated across endpoints. |
| Rich text editor | BlockNote (MPL-2.0) | Free for commercial/closed-source use, no paid tier for anything Beacon needs (real-time collaboration ships free/self-hostable via Yjs — only optional AI/multi-column/export "XL" add-ons are paid, none required here); ships an official shadcn/ui-compatible UI package and a block-schema API well-suited to the custom Screenshot Block. |
| Screenshot annotation | Fabric.js (MIT) | Mature, free canvas library sufficient for shapes/arrows/labels/blur. |
| Image storage (production) | AWS S3 — the company's existing bucket | Images stay on infrastructure the company already operates; no migration, no new service. |
| Image storage (local dev) | MinIO (Docker, zero account) | S3-API-compatible, so the presigned-URL code is identical to production — only env vars differ. Chosen over LocalStack, which stopped offering a true no-account free tier in March 2026. |
| Search | Postgres full-text search (native to Supabase) | Free, sufficient for v1 volume; both internal and public search paths are RLS-governed queries, no separate search service. |
| Multi-domain routing | Vercel for Platforms (Domains API) + Next.js Middleware + an `Organization` table | Resolves the request's `Host` header to an Organization on every request, so one deployment on the company's existing paid Vercel account serves multiple independently-branded domains (Dibimbing, Cakrawala University) without content crossing between them, with SSL handled automatically by Vercel. |

**Hosting:** the Next.js app deploys to the company's existing paid Vercel account (staging + production) — this is a locked decision, not just a recommendation: the paid plan is what makes Vercel for Platforms' multi-domain custom-domain automation available at all, and using infrastructure the company already pays for introduces no new recurring cost.

**Data model (initial entities):** `Organization` (name, domain, `is_domain_verified`), `Space` (inherits `organization_id`), `Page` (`visibility`, `is_published`, `published_content_snapshot`, `published_at`), `Block`, `ScreenshotBlock` (S3/MinIO object key + `annotation_json`), `Version`, `User` (`auth.users` + `profiles`, plus `organization_id` and an `owner`/`member` org role), `Permission`, `Comment`, `Feedback`. Full field-level detail lives in PROJECT.md Section 9.4 — Stage 1 mock data (Section 9, Epic 1) must mirror these shapes exactly.

**The hard subsystem — image upload without a custom backend:** the browser requests a presigned PUT URL from the Next.js app's own `/api/s3/presign` route (server-side, same process as the rest of the app), then uploads directly to S3 (prod) or MinIO (dev). No file or credential passes through Supabase. This is the one deliberate exception to "everything talks to Supabase directly" — full flow detailed in Section 8, Flow 3.

**Trust/anti-abuse in v1:** publish authority is enforced by RLS against page ownership/Space edit rights (never client-trusted); S3 credentials never reach the browser (only short-lived, single-object presigned URLs do); anonymous feedback submissions are rate-limited per IP in the presign/feedback Edge Function to prevent spam.

**Honest caveat:** self-hosting Supabase means the team owns backup scheduling, OS/Docker patching, and capacity planning that a managed Supabase Cloud plan would otherwise handle — this is a real ongoing responsibility traded for zero recurring SaaS cost.

## 7. Development Approach

Because the project is currently design-led, Stage 1 below is entirely **UI slicing against typed mock data** — no Supabase project, no S3 bucket, no login system beyond mock session state. Stage 2 is **backend integration** — the same UI gets its mock-data hooks swapped for real Supabase/S3 calls, with no UI redesign expected if Stage 1's mock types matched the real schema. This split exists so a UI/UX-led contributor (or an AI coding agent) can build and validate every screen in Section 8's flows before any backend decision blocks progress.

## 8. User Flows

Each flow below is written as a literal screen-by-screen sequence, so it can be sliced directly into components/pages without re-interpretation. Every flow names its actor, its entry point, its steps, and its failure paths — the two that always matter (network/offline, and empty/guest state) plus any flow-specific ones.

### Flow 1 — Account Creation & Login (User)
1. **Landing/Login screen** — email + password fields, "Sign in" button, "Don't have an account? Sign up" link.
2. **Sign Up screen** — name, email, password, confirm password fields, "Create account" button.
3. **Email verification screen** (if verification is required) — "Check your inbox" message, resend-email action.
4. On successful login/verification → redirect to **Workspace Home**.

**Failure paths:**
- Invalid credentials → inline error under the password field, form stays filled except password.
- Email already registered → inline error on the Sign Up form with a link back to Sign In.
- Network failure during submit → toast "Couldn't connect, please try again" with a retry button; form state is preserved, not cleared.

### Flow 2 — Workspace Home & Space/Page Creation (User)
1. **Workspace Home** — sidebar listing all Spaces the User has access to; main panel shows a welcome/empty state if the User has zero Spaces.
2. User clicks **"+ New Space"** → **New Space modal**: name field, "Publishable" toggle (default OFF / internal-only), "Create" button.
3. On create → redirected to the new (empty) **Space view**, showing an empty-Page-list state with a **"+ New Page"** CTA.
4. User clicks **"+ New Page"** → a blank Page is created and the **Page Editor** opens immediately (title field focused).
5. In the sidebar, the User can drag-and-drop reorder Pages within a Space, and create nested Sub-pages via a "+" affordance on hover of any Page row.

**Failure paths:**
- Zero-Spaces empty state → a single clear "Create your first Space" CTA, not a blank sidebar.
- Space name left blank → "Create" button stays disabled until a name is entered.

### Flow 3 — Authoring a Guideline Page, Including Screenshot + Annotation (User) — the core loop
1. **Page Editor screen** — title field at top, block-based body below, a persistent but unobtrusive save-status indicator ("Saving…" / "Saved").
2. User types content; pressing `/` opens a **slash command menu** listing block types (heading, list, checklist, code, quote, table, divider, screenshot).
3. User selects **"Screenshot"** from the slash menu (or drags an image file / pastes from clipboard directly into the body) → an empty **Screenshot Block** appears with an upload prompt (drag-drop area, "Paste" hint, "Choose file" button).
4. On image selection: (Stage 1) the image renders immediately from a local object URL; (Stage 2) the app requests a presigned URL from `/api/s3/presign`, uploads the file directly to S3/MinIO, then stores the returned object key — the User sees an upload progress indicator either way, then the image appears in an **Annotation Canvas** view.
5. **Annotation toolbar** appears above/beside the canvas: Box, Arrow, Numbered Marker, Text Label, Blur tools. User selects a tool and draws directly on the image; each annotation object is independently selectable, draggable, and deletable (a per-object delete/handle UI appears on selection).
6. User clicks **"Done annotating"** (or clicks outside the canvas) → the canvas locks into a rendered (non-editable-until-clicked-again) state, and a **Description field** appears directly below the image, prompting "Describe this step…".
7. User continues writing additional blocks below, or adds another Screenshot Block for the next step.
8. The Page remains in **Draft** state (internal-only, unpublished) throughout — there is no separate "save" action beyond the continuous autosave indicator from step 1.

**Failure paths:**
- Network drops mid-typing → save-status indicator changes to "Offline — saving locally"; edits buffer to IndexedDB; on reconnect, indicator shows "Syncing…" then "Saved", with no dialog or interruption to typing.
- Paste from Word/Google Docs produces unsupported formatting → the content still pastes as plain text/native blocks (never raw HTML), with no silent data loss.
- Re-opening a previously annotated screenshot → the canvas reopens in annotation-edit mode with all prior annotation objects intact, without re-triggering an upload.

### Flow 4 — Publishing, Updating, and Unpublishing a Page (User)
1. From the **Page Editor**, a **"Publish"** button sits in the top-right toolbar.
2. If the Page's Space is not marked publishable, **or its Organization has no verified domain yet** → the button is visibly disabled with a tooltip explaining which condition is unmet ("Ask a Space admin to mark this Space as publishable" / "Your Organization needs a verified domain before publishing — see Flow 7a") — never a silent dead click.
3. If eligible → clicking **Publish** opens a lightweight confirmation ("Publish this page? It will be visible on the public site immediately.") → on confirm, a success toast appears with a "View live page" link, and the Publish button changes state to show the page is live.
4. While published, if the author edits the Page further, a persistent banner appears at the top of the editor: **"You have unpublished changes"** with an **"Update"** button.
5. Clicking **Update** pushes the current draft to Viewers immediately (no confirmation needed, since it was already public) and the banner disappears.
6. A **"…" overflow menu** near the Publish button offers **"Unpublish"** → confirmation dialog ("Viewers will no longer be able to see this page.") → on confirm, the page is pulled from the public site and the Publish button reverts to its initial state.

**Failure paths:**
- Attempting to publish an empty/near-empty Page (e.g. title only, no body content) → inline validation warning suggesting the author add content first, without hard-blocking if they insist.
- Publish action triggered while offline → the action is queued with a visible "Will publish once back online" state, not silently dropped or falsely confirmed.

### Flow 5 — Viewer Browsing the Public Site (Viewer, no account)
1. **Public Site Home** — reached via an Organization's own domain (e.g. `docs.dibimbing.id` or `docs.cakrawala.ac.id`); no login prompt anywhere; a simplified table-of-contents sidebar (that Organization's publishable Spaces → their published Pages only) and a prominent search bar. A Viewer on one Organization's domain never sees any hint that other Organizations exist.
2. Viewer clicks a Page in the sidebar or a search result → **Public Page Read view**: rendered content, annotated screenshots visible exactly as authored, but with zero edit affordances, comments, or internal metadata shown.
3. At the bottom of every Public Page Read view: **"Was this helpful?"** with Yes/No buttons and an optional expandable free-text comment field.
4. Viewer clicks Yes or No → the buttons collapse into a brief "Thanks for your feedback" confirmation state (no page reload).

**Failure paths:**
- A Viewer has a Page open when it gets unpublished mid-session → any subsequent navigation/action on that page resolves to a clean **"This page is no longer available"** state (never a raw 404/500 or an internal-looking error).
- Search with no matching results → an explicit "No results for '…'" empty state, not a blank results panel.

### Flow 6 — Internal Search (User)
1. A **search bar** is persistently accessible from the Workspace shell (e.g. a keyboard shortcut + icon in the top nav).
2. Typing a query shows live results scoped to everything the User has access to (internal + published), ranked by relevance, each result showing the Space > Page breadcrumb.
3. Selecting a result navigates directly to that Page (Page Editor if the User has edit rights, else a read-only internal view).

**Failure paths:** zero results → "No results for '…', try a different term" state, matching the Viewer-side empty state for consistency.

### Flow 7 — Space Permissions (Space Admin)
1. From a **Space view**, an admin-only **"Members"** entry appears in the Space settings menu (hidden entirely for non-admins, not just disabled).
2. **Members screen** — a list of Users with access to the Space, each with a role dropdown (Viewer / Editor / Admin), plus an **"Invite by email"** action.
3. Changing a role in the dropdown saves immediately (no separate "Save" button), with a small inline confirmation.
4. Inviting a new User by email creates a **pending invite** row until that person accepts (via the Sign Up flow, Flow 1).

**Failure paths:** a non-admin User attempting to reach this screen directly (e.g. via URL) sees the same "not found"-style state as any unauthorized resource, never an error revealing the screen exists.

### Flow 7a — Organization Domain Settings (Organization Owner)
1. From an in-app **Organization Settings** area (e.g. a "Settings" entry in the top-level nav, distinct from any single Space's settings), the Organization Owner sees their **own** Organization's info: name and a "Domain" tab — never a list of other Organizations, since a User belongs to exactly one Organization and this screen is scoped to it, not a cross-org admin panel.
2. The **Domain tab** shows the current status: "No domain configured" / "Pending verification" / "Verified — live at `docs.dibimbing.id`".
3. Clicking **"Add domain"** opens a form for the custom domain string, and on submit, shows the exact DNS record (e.g. a TXT record value) the Owner needs to add at their domain registrar, plus a **"Verify"** button to re-check once it's added.
4. Once verified, the status flips to **Verified**, and Publish (Flow 4) becomes available for any publishable Space in that Organization.
5. The Owner can remove or replace the domain at any time from the same screen.

**Failure paths:**
- Verification check run before the DNS record has propagated → a clear "Not found yet — DNS changes can take a few hours" message, with a retry action, not a hard failure.
- A domain that's already claimed by another Organization → inline error preventing the duplicate before submission completes.
- A non-owner (regular member) of the Organization attempting to reach this screen → sees the same "not found"-style state as any unauthorized resource, matching Flow 7's pattern.

### Flow 8 — Comments & Mentions (User, Stage 3 feature)
1. Hovering any block in the **Page Editor** reveals a small comment-icon affordance.
2. Clicking it opens a **comment thread panel** anchored to that block, showing existing comments (author, timestamp) and a text input at the bottom.
3. Typing `@` in the input opens a **User mention dropdown**; selecting a User inserts the mention and, on submit, triggers a notification to that User.

**Failure paths:** none beyond the standard offline/retry pattern already defined in Flow 3.

### Flow 9 — Version History (User)
1. From the **Page Editor**'s **"…" overflow menu**, a **"Version History"** entry opens a side panel listing prior saved versions by timestamp (and author, if collaboration/Flow 8 is active).
2. Clicking a version shows a **read-only preview** of that version's content in the main panel, with a **"Restore this version"** button.
3. Confirming restore replaces the live draft with that version's content and creates a new version entry marking the restore event (so restoring is itself never destructive/unrecoverable).

## 9. Epics and Staged Delivery

### Stage 1 — UI Slicing (design-led, mock data only, no backend)

Every epic in this stage is buildable and demoable with zero Supabase project and zero S3/MinIO setup. All data comes from typed mock fixtures matching PROJECT.md Section 9.4's entity shapes, accessed only through thin hook abstractions (e.g. `usePages()`, `usePage(id)`) so Stage 2 can swap their internals without touching any component.

#### Epic 1: Project Scaffold & Mock Data Layer
- **US1.1:** As a developer/designer, I can run the entire project with a single `npm run dev` command, with no separate backend process required.
- **US1.2:** As a developer, I can define TypeScript types for every core entity (`Organization`, `Space`, `Page`, `Block`, `ScreenshotBlock`, `User`, `Permission`, `Comment`, `Feedback`, `Version`) matching PROJECT.md 9.4, so Stage 2 integration doesn't require re-deriving the schema.
- **US1.3:** As a developer, I can access all mock data exclusively through hook functions (`usePages()`, `usePage(id)`, `useCreateFeedback()`, etc.), never by importing mock fixtures directly into a component.

**AC:** `npm run dev` starts the full app with no other manual steps; every entity type defined in Stage 1 has a 1:1 field match with PROJECT.md 9.4 (reviewed before Stage 2 begins); a code-search for direct mock-fixture imports outside the hooks layer returns zero results.

#### Epic 2: Auth Screens (UI only, mock session)
- **US2.1:** As a User, I can see and interact with the Sign In and Sign Up screens (Flow 1), with client-side validation, even though no real account is created yet.
- **US2.2:** As a User, after "signing in" with any mock credentials, I land on Workspace Home with a mock session persisted in local state.

**AC:** Flow 1's screens and both named failure paths (invalid credentials, already-registered email) are all reachable and visually complete against mock responses.

#### Epic 3: Workspace Shell & Navigation
- **US3.1:** As a User, I see a sidebar listing mock Spaces/Pages, nested to at least 3 levels (Flow 2).
- **US3.2:** As a User, I can drag-and-drop reorder Pages in the sidebar, with the new order held in local state.
- **US3.3:** As a User, I can create a new Space or Page via the flows in Flow 2, including the empty-state CTA.

**AC:** all of Flow 2's steps and failure paths are implemented against mock data; sidebar nesting renders to 3+ levels; reorder persists across a client-side re-render (not necessarily a hard reload, since there's no backend yet).

#### Epic 4: Rich Text Editor UI (BlockNote)
- **US4.1:** As a User, I can type into a real BlockNote-powered block editor with no perceptible lag (< 50ms), per Flow 3 steps 1–2.
- **US4.2:** As a User, I can use the `/` slash command to insert any standard block type.
- **US4.3:** As a User, my content persists to local component/mock state with a visible save-status indicator, simulating the autosave behavior described in Flow 3 (real Supabase persistence comes in Stage 2).
- **US4.4:** As a User, pasting from Word/Google Docs converts into native blocks, not broken HTML.

**AC:** input latency < 50ms on a 100-block test page; all standard block types are insertable via `/`; the save-status indicator cycles through "Saving…"/"Saved" states even against the mock persistence layer; paste fixtures produce correctly typed blocks.

#### Epic 5: Screenshot & Annotation UI (Fabric.js)
- **US5.1:** As a User, I can add a screenshot via drag-drop, clipboard paste, or file picker (Flow 3, steps 3–4), rendering from a local object URL in Stage 1.
- **US5.2:** As a User, I can draw boxes, arrows, and numbered markers on the image.
- **US5.3:** As a User, I can add a text label and a blur/redact region.
- **US5.4:** As a User, I can exit annotation mode and add a text description directly below the image, per Flow 3 steps 6–7.
- **US5.5:** As a User, re-opening a previously annotated screenshot reopens the canvas with all annotation objects intact, from mock state.

**AC:** all three upload entry points work against local object URLs; every annotation type is independently addable, movable, and deletable; the description field appears exactly on exiting annotation mode, matching Flow 3; re-opening a screenshot never re-triggers the upload prompt.

#### Epic 6: Publishing UI (Flow 4)
- **US6.1:** As a User, I see the Publish button disabled with an explanatory tooltip when the Space isn't publishable.
- **US6.2:** As a User, I can click Publish, see a confirmation step, and see the page's state visibly change to "live" (all against mock state).
- **US6.3:** As a User, after publishing, editing the page shows the "unpublished changes" banner and Update action.
- **US6.4:** As a User, I can Unpublish via the overflow menu with a confirmation dialog.

**AC:** all four states in Flow 4 (not-publishable, draft, published-with-pending-changes, unpublished) are visually distinct and reachable; the disabled-button tooltip text matches Flow 4 step 2 exactly.

#### Epic 7: Public Site UI (Viewer experience, Flow 5)
- **US7.1:** As a Viewer, I can browse a public-site shell (simplified TOC + search bar) with no login prompt anywhere in the UI, scoped to a single mock Organization's content (Flow 5 step 1).
- **US7.2:** As a Viewer, I can open a Public Page Read view showing rendered content and annotated screenshots with zero edit affordances.
- **US7.3:** As a Viewer, I can submit "Was this helpful?" feedback and see the thanks-confirmation state, against mock state.
- **US7.4:** As a Viewer, I see the "This page is no longer available" state and the "no results" search state when applicable.

**AC:** the Public Page Read view is visually and structurally distinct from the authoring Page Editor (no shared edit-mode components leak through); both named failure states in Flow 5 are implemented and reachable via mock triggers (e.g. a dev-only toggle simulating "page unpublished"); the mock public site can be previewed under at least two different mock Organization contexts (e.g. via a dev-only Organization switcher) to verify the UI never mixes content between them.

#### Epic 8: Search UI (internal + public, Flow 6)
- **US8.1:** As a User, I can search and see ranked mock results with Space > Page breadcrumbs (Flow 6).
- **US8.2:** As a Viewer, I can search the public site with the same UI pattern but scoped visually to public content only, and further scoped to the current mock Organization.

**AC:** both search UIs share the same result-row component (breadcrumb + title + snippet) but are wired to separate mock data sources reflecting their different visibility scope, foreshadowing the real RLS-scoped queries in Stage 2; the public search mock data never includes results from a different mock Organization than the one currently being previewed.

#### Epic 8a: Organization Domain Settings UI (Flow 7a)
- **US8a.1:** As an Organization Owner, I can view my own Organization's domain status (name, domain, verification badge) — never a list of other Organizations.
- **US8a.2:** As an Organization Owner, I can add a domain and walk through the mock domain-verification screen (DNS instructions + "Verify" action).
- **US8a.3:** As a User, I see Publish (Epic 6) correctly disabled with an explanatory tooltip when my Organization has no verified domain yet.

**AC:** all states named in Flow 7a (No domain / Pending / Verified, duplicate-domain error, DNS-not-propagated-yet error, non-owner access) are visually implemented against mock state; the Organization Settings screen never renders any other mock Organization's data, even when multiple mock Organizations exist in the fixture set.

#### Epic 8b: Space Permissions UI (Flow 7)
- **US8b.1:** As a Space admin, I can see a "Members" entry in Space settings (hidden entirely for non-admins), leading to a list of mock Users with role dropdowns (Viewer/Editor/Admin).
- **US8b.2:** As a Space admin, changing a role in the dropdown updates immediately with an inline confirmation, against mock state.
- **US8b.3:** As a Space admin, I can invite a new User by email, creating a mock "pending invite" row.

**AC:** the Members entry is not merely disabled but entirely absent from the UI tree for non-admin mock Users; role changes and invites are reflected instantly in the mock Members list without a page reload.

#### Epic 8c: Comments & Mentions UI (Flow 8)
- **US8c.1:** As a User, hovering any block in the Page Editor reveals a comment-icon affordance that opens a comment thread panel anchored to that block.
- **US8c.2:** As a User, I can type a comment and use `@` to open a mock User mention dropdown, inserting the selected mention on submit.

**AC:** the comment panel renders against mock comment threads (author, timestamp, text); the `@` mention dropdown filters as the User types, against a mock User list.

#### Epic 8d: Version History UI (Flow 9)
- **US8d.1:** As a User, I can open a Version History panel from the Page Editor's overflow menu, listing mock timestamped versions.
- **US8d.2:** As a User, I can select a version to see a read-only preview, and click "Restore this version" to replace the live draft, against mock state.

**AC:** restoring a mock version is itself logged as a new mock version entry (never destructively overwrites history); the preview panel is visually distinct (e.g. a banner) from the live editable draft so a User can't mistake it for the current version.

### Stage 2 — Backend Integration (Supabase + S3/MinIO wiring)

No new UI is built in this stage — every epic here swaps a Stage 1 mock-data hook for a real call, without changing the component tree.

#### Epic 9: Supabase Schema & RLS Policies
- **US9.1:** As a developer, I can run a migration that creates the real Postgres schema (`Organization`, Space, Page, Block, ScreenshotBlock, User/profiles, Permission, Comment, Feedback, Version) matching the Stage 1 mock types exactly.
- **US9.2:** As a developer, I can define RLS policies enforcing: a User only edits Spaces/Pages they have rights to; a Page is publicly readable only when `visibility = publishable AND is_published = true`; a User can publish/unpublish only their own content (or content in a Space where they're an editor/admin).
- **US9.3:** As a developer, I can define RLS policies for `Organization`: the row is publicly readable (needed for domain routing to resolve a hostname to an Organization), but only that Organization's `owner`-role User can update its domain fields.

**AC:** the migration runs cleanly on the self-hosted Supabase instance; an automated test attempts to read an internal-only Page via the anonymous (`anon`) role and asserts it returns zero rows; an automated test attempts a write as a viewer-role User via the API and asserts a permission-denied response; an automated test attempts to update an Organization's domain as a `member`-role User (not `owner`) and asserts rejection.

#### Epic 10: Auth Integration
- **US10.1:** As a User, my Sign Up/Sign In from Epic 2's UI now creates and authenticates a real Supabase Auth account.
- **US10.2:** As a User, my session persists across browser restarts for at least 7 days.

**AC:** account creation requires a verified email; the mock session from Epic 2 is fully replaced (no dual state); session persistence verified via a browser-restart test.

#### Epic 11: Space/Page/Block Data Integration
- **US11.1:** As a User, my Spaces/Pages/Blocks from Epics 3–4 now read from and write to Supabase instead of mock state, with autosave firing ≤3s after the last keystroke and buffering to IndexedDB on network loss (completing Flow 3's failure path for real).
- **US11.2:** As a User, my Page's version history from Epic 8d's UI now reflects real saved snapshots in Supabase.

**AC:** an automated offline/reconnect test against the real Supabase connection results in zero content loss; restoring a version produces content byte-identical to that snapshot.

#### Epic 12: Image Upload Integration (S3/MinIO)
- **US12.1:** As a developer, `npm run dev` automatically starts a local MinIO container so screenshot uploads from Epic 5's UI work against a local S3-compatible endpoint with zero AWS account involvement.
- **US12.2:** As a User, uploading a screenshot from Epic 5's UI now calls `/api/s3/presign`, uploads directly to MinIO (dev) or AWS S3 (prod), and persists the resulting object key + `annotation_json` to Supabase.

**AC:** `npm run dev` requires no manual Docker command from the developer; switching the app from dev to a production build changes only environment variables, not code, to point at the real AWS S3 bucket; a per-upload size cap is enforced server-side in the presign route.

#### Epic 13: Publishing Integration
- **US13.1:** As a User, my Publish/Update/Unpublish actions from Epic 6's UI now atomically update `is_published` and `published_content_snapshot` via a Supabase Edge Function.
- **US13.2:** As a Viewer, the Public Site UI from Epic 7 now reads real published content via the RLS-governed anonymous query, scoped to the resolved Organization.

**AC:** an automated test attempts to fetch an internal-only Page via the public (anonymous) client and asserts zero results in 100% of runs; editing after Publish does not change what Viewers see until Update is called, verified against real data.

#### Epic 14: Search Integration
- **US14.1:** As a User, the internal search UI from Epic 8 now queries real Supabase data scoped by my RLS-visible rows.
- **US14.2:** As a Viewer, the public search UI now queries only published, publishable-Space content via the anonymous role, further scoped to the resolved Organization.

**AC:** an automated test confirms the public search query returns zero results for any unpublished page, even on an exact title match, against the real database; a search on `docs.cakrawala.ac.id` is confirmed (via automated test) to never return a Dibimbing-Organization result, and vice versa.

#### Epic 14a: Multi-Domain Routing Integration
- **US14a.1:** As a developer, I can implement the Next.js Middleware that resolves the request `Host` header to a real `Organization` row (via Vercel for Platforms) and scopes rendering/search accordingly, replacing Epic 8a's mock Organization switcher.
- **US14a.2:** As an Organization Owner, my domain-add and verification flow (Epic 8a's UI) now calls Vercel's Domains API and performs a real DNS check, only marking the domain "Verified" once it passes.
- **US14a.3:** As a developer, I can configure the two known Organizations (Dibimbing, Cakrawala University) with their real domains on the company's Vercel project as part of this epic's rollout.

**AC:** an automated test requests the app with each of the two real domains in the `Host` header and asserts each returns only that Organization's content; a request with an unrecognized `Host` header returns the "not configured" state, never a fallback to real content; domain verification correctly fails against an unpropagated/incorrect DNS record and correctly passes once the real record is in place; SSL is confirmed active on both real domains via Vercel's automatic provisioning.

### Stage 3 — Engagement & Collaboration Layer

#### Epic 15: Feedback Integration
- **US15.1:** As a Viewer, my feedback submissions from Epic 7 now persist as real `Feedback` rows, rate-limited per IP via an Edge Function.
- **US15.2:** As a User, I can see the real aggregate helpfulness rate for my published pages.

**AC:** feedback submission remains unauthenticated and single-click for the Yes/No portion; helpfulness rate = Yes / (Yes + No), computed from real data and visible in the authoring UI.

#### Epic 16: Comments & Mentions
- **US16.1:** As a User, I can use Epic 8c's comment UI to leave real, persisted comments on any block I have access to.
- **US16.2:** As a User, mentioning another User (`@name`) sends them a real notification.

**AC:** comments persist per-block with author + timestamp; a mentioned User receives a notification within 1 minute of the mention being posted.

#### Epic 17: Roles & Permissions
- **US17.1:** As a Space admin, Epic 8b's Members UI now assigns real roles enforced by the RLS policies from Epic 9.
- **US17.2:** As a viewer-role User, I can read a Space's Pages but the UI correctly hides/disables edit and publish actions, matching what the RLS layer would reject anyway.

**AC:** every write/publish endpoint enforces permission checks server-side (RLS), verified by an automated test attempting a write via the API as a viewer-role User and asserting rejection — the UI-level restriction from US17.2 is a UX convenience, never the actual security boundary.

### Stage 4 — Post-launch (named, not scoped in detail)

- **Epic 18: Real-time Collaboration (Supabase Realtime).** Multiple Users co-editing one Page simultaneously with live cursors, using Supabase's built-in Realtime (Postgres logical replication) rather than a separately self-hosted Yjs/WebSocket server. Deferred because Stage 1–3's async editing covers near-term needs at far lower build cost.
- **Epic 19: Third-Party Integrations (Slack, SSO).** Slack notifications on publish events; SSO login via Supabase Auth's OAuth providers. Deferred per the finalized non-goals; revisit once account volume justifies the investment.
- **Epic 20: Usage Analytics Dashboard.** An internal dashboard surfacing adoption, search success rate, and public traffic trends beyond the manually-tracked Stage 1–3 numbers. Deferred until there's enough data volume to make a dashboard worth building.
- **Epic 21: Localization (Multi-language).** English (and potentially other languages) support for authoring and public content, requiring a per-locale content model. Deferred — Bahasa Indonesia only for v1, per the finalized scope.
- **Epic 22: Native Mobile App.** Dedicated iOS/Android apps beyond the responsive web app. Deferred pending Phase 1 data on mobile web usage.

## 10. Non-Functional Requirements

- **Performance:** editor input latency < 50ms on pages with 100+ blocks; public page first-contentful-paint < 2s on a standard broadband connection; autosave round-trip ≤ 3s once integrated.
- **Reliability:** zero tolerated data loss from autosave failures — enforced via the local buffer + retry mechanism (Epic 11), covered by automated offline-simulation tests. Because Supabase is self-hosted, the team must run its own scheduled backup routine (e.g. `pg_dump`) — no managed automatic backup exists.
- **Availability:** target 99.5% uptime for the public site once launched (public help center is customer-facing).
- **Accessibility:** editor and public site keyboard-navigable; public site meets WCAG 2.1 AA for text contrast; images/annotations include alt-text fields for screen readers.
- **Cost:** all core software components carry $0 licensing cost (Section 6); the only variable costs are the company's existing AWS S3 usage and the self-hosted VPS's own capacity, both pre-existing, not new bills introduced by Beacon.
- **Privacy:** public feedback is anonymous by design (no PII collected beyond optional free text); S3 credentials never reach the browser — only short-lived presigned URLs do.
- **Localization:** Bahasa Indonesia only for v1, both authoring UI and public content (Epic 21, deferred for multi-language).
- **Dev environment parity:** local development must never require an AWS account, a company credential handoff, or any manually-run backend process beyond `npm run dev`.

## 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Stage 1 mock data types drift from the real schema once Stage 2 begins | Rework of UI components during integration, defeating the point of the phased approach | Treat Epic 1's TypeScript types as a first-class schema draft, reviewed against PROJECT.md 9.4 before Stage 1 begins in earnest, not adjusted ad hoc per screen |
| `@blocknote/shadcn` is a newer, less battle-tested UI package than BlockNote's default Mantine styling — visual/interaction gaps may surface against DESIGN.md's spec | Stage 1 (Epic 4) schedule slip or visual QA rework | Timebox Epic 4 to a fixed sprint budget; budget explicit visual-QA passes against DESIGN.md §6; fall back to CSS-variable overrides on the default styling if a `@blocknote/shadcn` gap blocks a specific component |
| Fabric.js canvas performance on low-end devices/mobile browsers | Degraded annotation UX for some Users | Performance-test on a low-end device profile early in Epic 5; cap max annotation objects per screenshot |
| Accidental public exposure of internal content once real RLS policies are written (Epic 9) | Severe — leaks internal SOPs/sensitive data to Viewers | Automated CI tests attempting anonymous reads of internal content, required to pass before any deploy touching RLS policies |
| No approval gate before publishing (by design) | A low-quality or incorrect guideline can go live and damage user trust | Make Unpublish/Update fast and frictionless (Epic 6/13); surface helpfulness feedback (Epic 15) prominently so bad content gets caught and fixed quickly |
| Self-hosted Supabase has no managed backups or patching | Data loss or security drift if ops discipline lapses | Scheduled backup routine and patch cadence documented as an explicit owner's responsibility before Stage 2 goes live, not left implicit |
| Domain routing misconfiguration crosses brand content, or an unverified domain serves real data | Severe — Cakrawala content appearing on a Dibimbing domain (or vice versa) is a brand/trust failure, not just a bug | Middleware defaults to "not configured" for any unrecognized/unverified `Host`, never a fallback; automated tests assert per-domain content isolation before any deploy touching Epic 14a; relying on Vercel for Platforms' automatic SSL/domain handling removes most manual-config failure modes |

## 12. Out of Scope (v1)

- Approval/review workflow before publishing (Users publish their own content directly).
- Multi-language/localization beyond Bahasa Indonesia (Epic 21, deferred).
- Real-time collaborative editing (Epic 18, deferred).
- Third-party integrations: Slack notifications, SSO (Epic 19, deferred).
- Native iOS/Android apps (Epic 22, deferred).
- Usage analytics dashboard beyond basic helpfulness/reach tracking (Epic 20, deferred).
- A custom backend API server of any kind (explicitly rejected in favor of Supabase + one Next.js API route).
- Migrating image storage off the company's existing AWS S3 (staying on S3, not moving to Supabase Storage).
- Fully self-serve domain management for arbitrary future brands beyond the two known Organizations (Dibimbing, Cakrawala University) — v1 supports the Organization/domain model generally, but isn't building a public domain-management SaaS; adding a third Organization is an admin/engineering action, not a self-service product surface.
- Project/task management features (never in scope, per PROJECT.md).
- Video annotation (static images only, per PROJECT.md).
- Public site branding/visual theming implementation — handled separately by the team's own UI/UX design work; Beacon only needs to expose a themeable template.
- Monetization/payments (not applicable to this product).

---

**Next step:** begin Stage 1 (Epics 1–8d) — a UI/UX-led build against mock data, with no backend prerequisites — using Section 8's flows as the direct spec for each screen.
