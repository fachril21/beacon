# Beacon — Internal Documentation Platform

**Company:** Dibimbing
**Status:** Final
**Owner:** Dibimbing
**Last updated:** 2026-08-06

---

## 1. Background

Dibimbing operates several platforms (web, mobile, internal dashboards, etc.), each of which needs internal **guidelines** — covering how to use features, SOPs, and onboarding references. There is currently no single, centralized place that makes creating these guidelines **easy, fast, and pleasant to read**.

Beacon is an internal documentation platform inspired by GitBook and Notion, but optimized for Dibimbing's specific use case: **producing visual-rich product guidelines** (screenshots + annotations) without friction.

## 2. Problem Statement

- Product guidelines are scattered across many places (Google Docs, Slack, personal Notion, etc.) — inconsistent and hard to find.
- Creating visual documentation (annotated screenshots) is slow, since it requires editing images in separate tools (Figma/Photoshop) before pasting them manually into a document.
- Existing tools (Notion/GitBook) are powerful but generic — they lack a dedicated "screenshot → annotate → describe" flow.
- There is no single source of truth for guidelines across all of Dibimbing's platforms.

## 3. Product Goals

1. Become the single, centralized place for all guidelines across Dibimbing's platforms.
2. Make guideline authoring **as fast and effortless as possible**, especially for visual content (screenshot + annotation).
3. Provide a text editor that is **highly responsive and reliable** for both long-form and short-form writing.
4. Produce guidelines that are easy to read, search, and navigate — similar to GitBook.
5. Serve every business line under Dibimbing Group (Dibimbing, Cakrawala University, and any future additions) from one shared platform, each with its own independently-branded public domain.

## 4. Target Users

Beacon has two distinct user types:

- **User** — an account holder (Dibimbing internal team member) who creates, edits, and publishes documentation. A User has full authority over the content they own: they can publish their own pages to the public site directly, with **no superadmin/approval step required**. Role/permission scoping (viewer/editor/admin per Space, see 5.5) governs *internal* collaboration rights, not publishing rights — publishing is an action a page's author/editor can take unilaterally.
- **Viewer** — an end user of Dibimbing's products who reads published documentation on the public site. Viewers **do not need an account**; they access public content anonymously, read-only.

## 5. Core Features

### 5.1 Workspace & Document Structure
- GitBook-like structure: **Space/Collection** → **Page** → **Sub-page** (nested).
- Sidebar navigation with drag-and-drop reordering.
- Full-text search across all documents.

### 5.2 Rich Text Editor
- Block-based editor (Notion-like), highly **responsive** (no lag on fast typing) and **reliable** (auto-save, no risk of losing content — requires offline-resilience / retry logic when a save fails).
- Standard formatting support: headings, bold/italic, bullet & numbered lists, checklists, code blocks, quotes, tables, dividers.
- Slash command (`/`) for quick block insertion.
- Paste support from external sources (Word, Google Docs) without breaking formatting.
- Document version history.

### 5.3 Screenshot & Annotation (key differentiator)
- Upload screenshots directly into the editor (drag-drop, clipboard paste, or file upload).
- Built-in annotation tool on top of screenshots, with no external tools required:
  - Box/highlight for specific areas
  - Arrows to point at elements
  - Numbered markers (e.g. step 1, 2, 3 on the image)
  - Text labels directly on the image
  - Blur/redact for sensitive areas (e.g. user data)
- After annotating, the user can immediately add a **text description** below/beside the image in the same block — the "1 screenshot + 1 annotation + 1 description" pattern becomes a single, reusable unit block.
- Annotations are stored as a layer separate from the original image, so they can be re-edited without re-uploading the screenshot.

### 5.4 Collaboration
- Comments per block/section, with User mentions (`@name`) for notifications — this is the actual v1 collaboration mechanism.
- Multi-user **real-time** co-editing (live cursors, simultaneous typing) is explicitly deferred to a post-launch phase (see Section 9/PRD Stage 4) — it is not built in v1.
- **Conflict handling for v1:** since real-time co-editing isn't built yet, concurrent edits to the same Page rely on last-write-wins autosave plus Version History (5.2) as the recovery mechanism if two Users edit the same Page around the same time — there is no locking or "someone else is editing this" notification in v1. This is an accepted trade-off, not an oversight; revisit if it causes real friction once adoption grows.

### 5.5 Publishing & Access
- Each guideline can be organized per platform (e.g. Space "Mobile App", Space "Admin Dashboard", etc.).
- Role & permission system (viewer, editor, admin) per Space — governs internal collaboration (who can edit what), not publishing rights.
- **Public Publishing:** any Space or Page can be explicitly published to a public-facing site, so it can serve as public-facing product documentation/help center for Dibimbing's end users (Viewers). Key requirements:
  - Explicit **Publish** action, separate from internal saving — content is only internal/private by default until its author/editor (a User) deliberately publishes it. No accidental public exposure of internal drafts.
  - **No approval workflow.** A User who authored/owns a page can publish it directly — there is no superadmin sign-off gate. Publishing authority is tied to page/Space edit rights, not a separate reviewer role.
  - Published pages are served on a distinct **public site** (e.g. `docs.dibimbing.id` or similar), read-only, with no login required (Viewers are anonymous) and no visibility of internal-only Spaces/Pages.
  - **Draft vs. Published state** per page: authors can keep editing a page privately after it's been published; Viewers continue to see the last published version until the author explicitly re-publishes ("Update" action).
  - **Unpublish** action to pull a page back to internal-only at any time.
  - Public site has its own simplified navigation/table of contents, and should be searchable, SEO-friendly (proper meta tags, clean URLs), and reasonably fast (static or cached rendering, since content changes infrequently relative to reads).
  - Public pages inherit the same rich content (including annotated screenshots) but strip out internal-only elements (comments, mentions, edit history) from the public view.
  - Optional per-Space setting: mark an entire Space as "publishable" vs. "internal-only" to prevent internal Spaces (e.g. sensitive SOPs) from ever being publishable by mistake.
  - **Feedback mechanism:** each published page shows a lightweight "Was this helpful?" (yes/no, optionally with a free-text comment) for Viewers, so content owners can see which guidelines are effective and which need improvement.
  - **Branding/theming:** visual design of the public site (logo, colors, layout) is being handled separately by the team via dedicated UI/UX design work and is out of scope for this document — the platform should simply expose a clean way to apply that design (e.g. a themeable public template) rather than prescribe it here.
  - **Multi-domain publishing:** since Dibimbing Group operates more than one business line (Dibimbing and Cakrawala University, as of this writing), the public site is not a single fixed domain — it's one platform serving multiple independently-branded public sites, each on its own custom domain. Key requirements:
    - A new **Organization** grouping sits above Space: each Organization has a name (e.g. "Dibimbing", "Cakrawala University") and one custom domain (e.g. `docs.dibimbing.id`, `docs.cakrawala.ac.id`). This resolves the earlier open question of "who manages domain settings" — it's the Organization's own owner/admin, via an in-app settings screen, similar to how Notion lets a workspace owner add a custom domain.
    - Every Space belongs to exactly one Organization (inherited from its creator's Organization by default). A Space's Pages, once published, are only ever served on that Organization's domain — content never crosses between Organizations, even though they run on the same underlying platform.
    - A visitor's request is resolved to an Organization by the incoming domain itself (not a URL path or query param) — `docs.cakrawala.ac.id` and `docs.dibimbing.id` show two visually and structurally separate sites, each unaware of the other's content, from the same Beacon deployment.
    - A domain only serves live content once it's **verified** (DNS ownership check) — an unverified or misconfigured domain must not silently serve another Organization's content or leak a default/fallback Organization.
    - Search (public) is scoped per Organization as well — searching on `docs.cakrawala.ac.id` never surfaces a Dibimbing-only page, and vice versa.
    - Technically, this runs on **Vercel for Platforms** (Vercel's official multi-tenant custom-domain pattern): a domain is added to an Organization's settings in-app, the app calls Vercel's Domains API to register it against the deployment, and Vercel automatically issues and renews SSL for it — no manual certificate work at any point.

## 6. Non-Goals (out of initial scope)

- Not a project management tool (no task/ticket tracking).
- Not a video editor — annotation is limited to static images initially.
- Not a replacement for design tools (Figma) for UI design work, only for documentation.
- Third-party integrations (Slack notifications, SSO, etc.) are not a Phase 1 priority.
- **Multi-language/localization is out of scope for now.** Both the authoring experience and public-facing content will be **Bahasa Indonesia only** initially. No i18n framework or per-locale content structure is required in Phase 1; this can be revisited later if there's demand for English or other languages.
- **No custom backend API.** All CRUD, auth, and file handling go through Supabase directly (see Section 9) — a hand-built REST/GraphQL server is explicitly out of scope unless a specific need proves Supabase's built-in layer insufficient.

## 7. Product Design Principles

- **Speed to write:** from a blank page to a complete guideline with screenshot + annotation should take < 5 minutes.
- **Zero context-switch:** everything needed (writing, screenshots, annotation) lives in one editor — no need to switch apps.
- **Reliability first:** users must never lose their writing due to a failed save or crash.
- **Consistent & scalable:** the document structure must scale across many platforms without becoming messy.
- **Simplicity of infrastructure:** favor a managed, batteries-included backend (Supabase) over hand-rolled services wherever it meets the requirement — every custom server is something the team has to build, host, and maintain forever.
- **One repo, one command:** the entire project lives in a single frontend directory. Running it locally never requires the designer/developer to separately start, configure, or hold credentials for a backend service — `npm run dev` is the whole workflow.

## 8. Success Metrics (draft)

- Average time to create one guideline page (target: significant reduction vs. the current manual process).
- Number of active guidelines created per month.
- Adoption rate: % of internal teams actively writing/reading at least once a week.
- Search success rate (users find what they're looking for without asking a colleague).
- **Public site — Helpfulness rate:** % of "Was this helpful?" responses marked "Yes" on published pages.
- **Public site — Reach:** number of published pages and public page views over time.
- **Public site — Support deflection (directional):** qualitative/anecdotal tracking of whether well-documented guidelines correlate with fewer repetitive support questions from end users (exact measurement approach TBD, likely requires input from the CS team).

## 9. Technical Specification

### 9.1 Cost Principle

Cost minimization is a hard constraint for this project. All core tooling must be **free / open-source or free-tier-first**, with no recurring per-seat or per-document SaaS fees. Any candidate library or service with a paid tier for functionality Beacon actually needs is disqualified in favor of a free alternative — even if that means more in-house build effort. This now also extends to infrastructure: the team explicitly prefers **not building a custom backend API**, in favor of Supabase (self-hosted on the company VPS) for everything except image storage, which stays on the company's existing **AWS S3** rather than moving to Supabase Storage.

### 9.2 Tech Stack Decisions

| Layer | Choice | License / Cost | Rationale |
|---|---|---|---|
| Backend / Database / Auth / API | **Supabase, self-hosted on the company's own VPS** (Postgres, wrapped with instant REST + GraphQL via PostgREST, Auth, Storage, and Edge Functions) | Infra cost only (the VPS is already running) — no Supabase Cloud subscription needed | This is the change that removes the custom backend entirely. Supabase auto-generates a REST and GraphQL API directly from the Postgres schema, so the frontend talks to the database through Supabase's client SDK instead of a hand-built server — no Express/Node API layer to design, host, or maintain. **Because this instance is self-hosted rather than Supabase Cloud, the Cloud free-tier ceilings (500MB DB, 1GB storage, 5GB egress, 7-day auto-pause) do not apply** — capacity is bounded only by the VPS's own disk/CPU/RAM. In exchange, the team owns what Supabase Cloud would otherwise manage: OS/Docker updates, Postgres backups, uptime monitoring, and disk scaling. A backup routine (e.g. scheduled `pg_dump` + storage bucket backup) is still required, since self-hosting means there's no managed automatic backup either. |
| Authentication | **Supabase Auth** (same self-hosted instance) | Included, no extra cost | Replaces building a custom sign-up/login/session system. Handles account creation, session tokens, and (later, if needed) OAuth/SSO providers out of the box. |
| Rich text editor | **BlockNote** | MPL-2.0 — free for commercial/closed-source use, no paid tier for anything Beacon needs | **Revised decision — supersedes an earlier "Lexical over TipTap/BlockNote" choice.** That earlier call rested on the belief that BlockNote, being built on TipTap/ProseMirror, inherited TipTap's paid Collaboration/AI Toolkit ceiling ($49–999/mo). That premise doesn't hold up: BlockNote's own real-time collaboration (via Yjs, self-hosted through `y-websocket` or Hocuspocus) ships in its free/community tier — BlockNote's paid tier only gates optional "XL" add-ons (AI integration, multi-column layout, PDF/Docx/ODT export) that Beacon has no use for. Unlike Lexical (a low-level framework requiring the toolbar, UI, and block system to be built entirely in-house), BlockNote ships a ready-made editor with an official shadcn/ui-compatible UI package (`@blocknote/shadcn`) that consumes this project's existing OKLCH design tokens directly, and a block-schema API well-suited to a custom "Screenshot Block" (Section 9.3) without fighting the framework. It still satisfies the responsiveness/reliability requirement in Section 5.2, and if/when real-time collaboration (Section 12, Epic 18) is ever built, it stays on the same self-hosted, zero-license-fee footing as the rest of this stack. |
| Screenshot annotation | **Fabric.js** | MIT — free | A mature, widely-used canvas library well-suited to building an in-house annotation layer (shapes, arrows, numbered markers, text labels, blur/redact) on top of an uploaded image. Actively maintained, large community, no licensing cost. |
| Frontend framework & hosting | **Next.js (App Router)**, deployed to the **company's existing paid Vercel account** (staging + production) | $0 additional — already covered by the company's existing Vercel subscription, not a new cost | The one piece of "server-side" logic this project still needs — generating S3 presigned upload URLs without exposing S3 secret keys to the browser — lives as a Next.js **API Route**, co-located in the same repo and the same `npm run dev` process as the rest of the app. This keeps the entire project as **one frontend directory, one command to run**. Using the company's paid Vercel account also unlocks **Vercel for Platforms** (programmatic custom-domain support with automatic SSL) needed for the multi-domain publishing requirement below — this would otherwise require a Pro-tier-or-above plan, which the company already has. |
| File / object storage | **AWS S3** in production (the company's existing bucket) — **MinIO** locally for development | AWS S3: usage-based, already part of existing company infra. MinIO: $0, open-source, no account of any kind required | Images stay on the company's real AWS S3 rather than moving to Supabase Storage, per the team's decision — the company already operates this bucket, and there's no reason to migrate it. For local development, **MinIO** (not LocalStack) is the right fit: LocalStack ended its true no-account Community edition in March 2026 and now requires signing up for a free LocalStack account and auth token just to run it — which defeats the "no new account" goal. MinIO requires zero account of any kind, runs as a single Docker container, and is fully S3-API-compatible (same AWS SDK calls, same presigned-URL mechanism) — so the Next.js API route's code is identical between dev and prod; only the endpoint/credentials env vars change. |
| Multi-domain routing | **Vercel for Platforms** (Vercel's Domains API) + Next.js Middleware | $0 additional — a feature of the company's existing paid Vercel plan | Vercel's official pattern for exactly this use case: one Next.js codebase, multiple tenants (here, Organizations) each with their own custom domain, automatic SSL issuance/renewal per domain, and Middleware that reads the request's `Host` header to route/scope content per domain. This is a well-supported, first-class Vercel feature — not a custom-built subsystem the team has to maintain. |
| Real-time collaboration transport (if/when Section 5.4 is implemented) | **Supabase Realtime** (Postgres logical replication, built in) | Included, no extra cost | If/when live co-editing is built, Supabase Realtime is the natural fit since it's already part of the self-hosted stack — avoiding a separately self-hosted Yjs/WebSocket server. Still deferred to a post-launch epic; noted here so the eventual choice doesn't require re-deciding the transport layer. |

### 9.3 High-Level Architecture

- **Cross-boundary note:** the frontend (Vercel) and the backend (self-hosted Supabase on the company VPS) are two separate pieces of infrastructure talking over the public internet — this is normal and expected, not a contradiction of "one repo, one command." It just requires the self-hosted Supabase instance's API endpoint to be reachable over HTTPS from the internet (already true for any self-hosted Supabase setup that the Next.js app — running on someone's laptop or on Vercel — needs to reach).
- **Frontend:** a single Next.js (App Router) application — this is the *entire* project directory. React components for the editor/annotation UI, plus one small API route for S3 presigned URLs (see below). No separate backend repo or service exists.
- **Editor layer:** BlockNote core + a custom block schema (`BlockNoteSchema.create`) for: block types (heading, list, table, code, checklist, divider), a slash command menu, and a custom "Screenshot Block" spec that embeds the annotation canvas.
- **Annotation layer:** Fabric.js canvas mounted inside the custom Screenshot Block node. Annotation state (shapes, arrows, labels, positions) is serialized as JSON and stored alongside a reference to the original image file in S3, so re-editing does not require re-uploading the source screenshot.
- **Data layer:** the Next.js app talks to the self-hosted Supabase instance directly via the Supabase client SDK, from the browser, for everything except image bytes:
  - **PostgREST auto-API** — direct, permission-checked CRUD on Spaces/Pages/Blocks/Comments/Feedback from the frontend.
  - **Row Level Security (RLS) policies** — the actual enforcement layer for every access rule in this document (viewer/editor/admin roles, internal-vs-public visibility, "a User can only publish their own content"). RLS policies live in the database itself, so there is exactly one place these rules are defined and enforced.
  - **Supabase Edge Functions** — for the handful of operations that need server-side logic beyond a row-level check (e.g. computing a page's aggregate helpfulness rate, generating a `published_content_snapshot` atomically on Publish/Update, rate-limiting anonymous feedback submissions by IP). These are deployed once to the shared Supabase instance by whoever manages it — a designer working on Beacon never needs to run them locally.
- **Image upload flow (the one part that is NOT pure Supabase):**
  1. The Next.js app requests a presigned upload URL from its own `/api/s3/presign` API route (server-side, same repo, same `npm run dev` process).
  2. That route uses the AWS SDK, configured entirely via environment variables (`S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`, `S3_FORCE_PATH_STYLE`), to generate a short-lived presigned PUT URL.
  3. The browser uploads the image bytes directly to that URL — straight to S3 (prod) or MinIO (dev) — without the file or any credential passing through Supabase at all.
  4. The resulting object key is saved on the `ScreenshotBlock` row in Supabase, alongside the `annotation_json` layer.
  - **Local development:** the `.env.local` file points at a MinIO container (`http://localhost:9000`, dummy credentials, `S3_FORCE_PATH_STYLE=true`) started automatically by the dev script (see below) — no AWS account, no company credentials needed.
  - **Production:** the same route, same code, reads different env vars pointing at the company's real AWS S3 bucket (real IAM credentials scoped to just that bucket, `S3_FORCE_PATH_STYLE=false`, real region) — a config change, not a code change.
- **One command to run locally:** the `npm run dev` script is wired (e.g. via a `predev` hook or `concurrently`) to first bring up the local MinIO container (`docker compose up -d`) and then start the Next.js dev server — so from the designer's perspective, there is genuinely only one thing to run, even though a lightweight local S3 emulator is quietly running in the background.
- **Search architecture:** Postgres full-text search (native to Supabase, upgradeable to a dedicated engine like Meilisearch later if needed), queried through **two RLS-governed paths** so permission rules can never leak across them:
  - **Internal search** — an authenticated Supabase client query, automatically scoped by that User's RLS-visible rows (internal + published content per their access) — no extra endpoint code needed, since RLS enforces this by default.
  - **Public search** — an anonymous (`anon` role) Supabase client query, which RLS restricts to rows where `visibility = publishable` and `is_published = true` by policy definition, not by application code remembering to filter. This is fully anonymous and cacheable.
  - Because both paths hit the same tables under the same RLS policies, there is no risk of two divergent filter implementations drifting apart — the single policy is the single source of truth.
- **Storage:**
  - **AWS S3 (production) / MinIO (local dev):** original screenshots + any exported/rendered images, uploaded directly from the browser via the presigned-URL flow above. A per-upload size cap is enforced in the `/api/s3/presign` route before issuing a URL.
  - **Database (Supabase Postgres, self-hosted):** document content (BlockNote `Block[]` JSON state), annotation JSON, page tree/structure, version history, permissions, comments, feedback responses.
- **Auto-save / reliability:** client-side debounce autosave directly to Supabase, with local draft persistence (e.g. IndexedDB) as a fallback buffer so in-progress edits survive network failures or crashes until the next successful sync.
- **Multi-domain routing:** the public site is multi-tenant by domain, not by URL path — implemented with **Vercel for Platforms**, Vercel's official pattern for this exact scenario. A **Next.js Middleware** function runs on every incoming request, reads the `Host` header, and looks up the matching `Organization` row (a lightweight, publicly-readable table — domain names aren't sensitive) to determine which Organization's content to render. The middleware then scopes every subsequent Supabase query (page render, public search) to that Organization's Spaces only — on top of, not instead of, the existing `visibility`/`is_published` RLS filter. A request on an unrecognized/unverified domain gets a generic "not configured" response, never a fallback to any real Organization's content. When an Organization owner adds a custom domain in-app (Section 5.5), the app calls Vercel's Domains API to register that domain against the Vercel project, and Vercel automatically issues/renews the SSL certificate — no manual certificate work.
- **Hosting:** the Next.js app deploys to the company's existing paid Vercel account (staging + production environments). This isn't just convenient — the paid plan is what makes the Vercel for Platforms multi-domain feature available at all (custom-domain automation is a Pro-tier-and-above capability), and it removes any need to self-host SSL/reverse-proxy infrastructure for multi-domain support.

### 9.4 Data Model (draft, high-level)

- `Organization` — represents one independently-branded public domain and its member Users (e.g. "Dibimbing" → `docs.dibimbing.id`, "Cakrawala University" → `docs.cakrawala.ac.id`). Fields: `name`, `domain`, `is_domain_verified`, `created_at`. Publicly readable (domain names aren't sensitive), but only usable for rendering once verified. Every `User` belongs to exactly one Organization (`organization_id`), with an `organization_role` of `owner` (can manage domain settings, invite members) or `member` (default) — this is what resolves who can manage domain settings, distinct from the per-Space viewer/editor/admin roles below.
- `Space` — top-level container per platform (e.g. "Mobile App", "Admin Dashboard"), inherits its `organization_id` from its creator's Organization — this is what determines which domain a Space's published Pages appear on.
- `Page` — belongs to a Space, supports nesting (`parent_page_id`), holds ordered content blocks. Includes publishing state: `visibility` (internal / publishable), `is_published` (boolean), `published_content_snapshot` (last published version, decoupled from the live-editing draft), `published_at`.
- `Block` — a unit of content within a Page (text block, heading, table, **screenshot block**, etc.).
- `ScreenshotBlock` — references an S3 object key (original image, on AWS S3 in production / MinIO in development) + an `annotation_json` field (Fabric.js canvas state) + an associated description text block.
- `Version` — snapshot of a Page's content for history/rollback.
- `User` — backed by `auth.users` (Supabase Auth) plus a `profiles` table for app-specific fields (name, avatar); the author/owner of the content they create, with authority to publish/unpublish their own pages directly.
- `Permission` — role (viewer/editor/admin) scoped per Space and/or Page, governing internal collaboration rights; implemented as rows checked by RLS policies rather than app-layer logic.
- `Comment` — attached to a Block, with author, timestamp, and thread.
- `Feedback` — attached to a published Page; anonymous Viewer response (`helpful: yes/no`, optional free-text comment), timestamped.

### 9.5 Non-Functional Requirements

- **Performance:** editor must remain responsive (no perceptible input lag) even on pages with many blocks and multiple annotated screenshots.
- **Reliability:** zero data-loss tolerance — autosave + local draft buffering + retry-on-failure are mandatory, not optional. Because Supabase is self-hosted (not Supabase Cloud), automated backups are **not provided by a managed service** — the team must set up its own scheduled backup routine (e.g. `pg_dump` for the database, a periodic sync/snapshot of the MinIO/RustFS storage volume) as part of standing up the VPS instance, not as an afterthought.
- **Scalability:** document structure and search must remain performant as the number of Spaces/Pages grows across all of Dibimbing's platforms. Since this is self-hosted, there is no Supabase-imposed usage ceiling to watch — capacity planning instead means monitoring the VPS's own disk, CPU, and RAM as content and traffic grow, and scaling the VPS (or splitting Postgres/Storage onto separate volumes) proactively rather than reactively.
- **Security:** all access control (role-based permissions, internal-vs-public visibility) is enforced via Postgres Row Level Security policies at the database layer — never client-side filtering, and never logic duplicated across multiple hand-built endpoints. Public site rendering and public search must only ever return rows where `visibility = publishable` and `is_published = true`, guaranteed by RLS policy rather than by remembering to add a `WHERE` clause in application code. S3 credentials never reach the browser: the Next.js API route holds them server-side and only ever hands the client a short-lived, single-object presigned URL. Local dev MinIO credentials are intentionally dummy/throwaway values (e.g. `minioadmin`) since the container is only reachable on `localhost` and holds no real data. **Domain routing adds one more requirement:** a request on a domain that isn't a verified `Organization` must never fall back to serving any real Organization's content — this prevents both accidental cross-brand leakage and a subdomain-takeover-style attack via an unverified/misconfigured DNS entry. Since the Supabase instance is self-hosted, the team is also responsible for its own OS/Docker security patching and network hardening (firewall rules, VPS access control) — this isn't handled by a managed provider.

### 9.6 Cost Summary

| Component | Recurring cost |
|---|---|
| Supabase (self-hosted on existing company VPS: Database + Auth + API + Edge Functions) | $0 additional — running on infra the company already has; no Supabase Cloud subscription |
| Next.js frontend + hosting (company's existing paid Vercel account, staging + production) | $0 additional — already covered by the company's existing Vercel subscription |
| Vercel for Platforms (multi-domain custom domain support) | $0 additional — included in the company's existing paid Vercel plan |
| AWS S3 (production image storage) | Usage-based, already existing company infra/bucket — not a new cost introduced by Beacon |
| MinIO (local dev S3 emulation only) | $0 — open-source, no account required, runs only on developer machines |
| BlockNote (editor) | $0 |
| Fabric.js (annotation) | $0 |
| Supabase Realtime (deferred, if/when built) | $0 — included in the self-hosted stack |

No component in this stack carries a per-seat, per-document, or feature-gated SaaS license fee. Because Supabase is self-hosted, S3 is an existing company resource, and Vercel is an existing paid company subscription, Beacon introduces **no new recurring bill at all** — only the VPS's own capacity (disk/CPU/RAM) and standard AWS S3 usage costs the company already accounts for.

## 10. Open Questions

- Confirm the self-hosted Supabase instance's API endpoint is reachable over HTTPS from the public internet, since the Vercel-hosted frontend needs to reach it from outside the company VPS.
- Which Vercel team/project the company's existing account will use for Beacon staging vs. production, and who holds admin access to configure the Vercel for Platforms domain settings.
- Domain verification mechanism: DNS TXT record check, a CNAME target, or another method Vercel's Domains API expects — and whether an interim Vercel-provided subdomain (e.g. `dibimbing.<vercel-project>.vercel.app`) should be offered so an Organization can go live before its real custom domain's DNS is configured by each business line's own IT.
- Which storage backend the existing self-hosted Supabase instance already uses internally (relevant for Auth/DB only now, since image storage is confirmed to stay on AWS S3, not Supabase Storage).
- AWS S3 handoff process: who on the engineering team provisions a scoped IAM credential (bucket-restricted, presign-only) for the Next.js API route to use in production, and how/when that gets shared once the designer's local build is ready to deploy.
- Backup strategy and schedule for the self-hosted Supabase instance (database) — this is the team's responsibility now, not a managed service's.
- VPS capacity planning: current disk/CPU/RAM headroom, and the threshold at which the team should scale the VPS.
- Per-upload file size cap for the `/api/s3/presign` route, and any image compression/optimization applied before or after upload.
- Whether a mobile app is needed, or a responsive web app is sufficient for Phase 1.
- Whether the public site needs deeper analytics (beyond the helpfulness feedback in 5.5) for Phase 1 or later.
- Whether Success Metrics (Section 8) should be tracked per-Organization (Dibimbing vs. Cakrawala University separately) in addition to the aggregate numbers, given they're now structurally separate public sites.

## 11. Development Approach

Given the current phase is design-led (UI/UX-driven, not yet backed by an engineering team actively building), Beacon's initial build is sequenced in two explicit sub-phases within Phase 1:

- **Phase 1a — UI slicing with mock data.** Build out the full authoring UI and public-site UI (Sections 5.1–5.5) against static mock data, before wiring up Supabase or S3 at all. To keep this from becoming throwaway work:
  - Mock data fixtures should mirror the entity shapes already defined in Section 9.4 (`Space`, `Page`, `Block`, `ScreenshotBlock`, `User`, `Feedback`, etc.) as TypeScript types/interfaces, even though nothing is persisted yet — this is what makes swapping mock data for real Supabase calls later a plumbing change, not a redesign.
  - All data access should sit behind a thin abstraction (e.g. hook functions like `usePages()`, `usePage(id)`, `useCreateFeedback()`) that return mock data now and get their internals swapped for real Supabase client calls later — components should never read mock data directly.
  - Both the **User (authoring)** experience and the **Viewer (public site)** experience should be sliced from the start, since they're meaningfully different UIs (edit affordances vs. read-only + feedback widget) built on the same content — designing only the authoring UI first risks under-designing the public experience that's actually the product's public face.
- **Phase 1b — Schema, RLS, and integration.** Once the UI is sliced, define the real Supabase Postgres schema and RLS policies matching Section 9.4, wire the mock-data hooks to real Supabase client calls, and implement the `/api/s3/presign` route + MinIO/S3 upload flow from Section 9.3.

This sequencing is a reasonable trade-off for a design-led start — it lets visual/UX decisions move fast without waiting on backend groundwork — but it does mean Phase 1a's mock data types are a **de facto first draft of the schema**, so it's worth treating them with the same care as a real schema decision rather than as disposable placeholders.

## 12. Rough Roadmap (for discussion)

| Phase | Focus |
|---|---|
| Phase 1a (MVP, design-led) | UI slicing for the core editor, screenshot/annotation UI, Space/Page structure, Organization/domain settings UI, and public site — all against typed mock data, no backend wiring yet |
| Phase 1b (MVP, integration) | Supabase schema + RLS policies + Auth wiring + `/api/s3/presign` route and MinIO/S3 upload flow + Vercel for Platforms domain routing (Dibimbing + Cakrawala University), replacing the mock-data layer |
| Phase 2 | Search, version history, comments, role-based permissions (RLS refinement), public site polish (SEO, caching), domain verification flow for additional Organizations beyond the initial two |
| Phase 3 | Real-time collaboration (Supabase Realtime), integrations (Slack/SSO via Supabase Auth providers), usage analytics (internal + public site) |

---

_This document reflects finalized scope and technical direction for Beacon's initial build: a self-hosted Supabase backend (on the company's own VPS) paired with a Next.js frontend on the company's existing paid Vercel account, using Vercel for Platforms for multi-domain publishing across Dibimbing Group's business lines._
