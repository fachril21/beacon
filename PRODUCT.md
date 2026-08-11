# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) + Tailwind CSS + shadcn/ui, deployed to the company's existing paid Vercel account. Rich text editor: BlockNote (with the official `@blocknote/shadcn` UI package, matching the rest of the product's component system). Screenshot annotation: Fabric.js. Backend (Phase 1b, not yet wired): self-hosted Supabase (Postgres + Auth + PostgREST + Edge Functions) on the company VPS; image storage on AWS S3 (prod) / MinIO (dev). Phase 1a — the current phase — is UI-only against typed mock data behind hook abstractions (`usePages()`, `usePage(id)`, etc.); no backend calls exist yet. Single frontend repository, one `npm run dev` command.

## Users

Two distinct audiences sharing one codebase, with meaningfully different UIs:

- **User (internal, primary)** — a Dibimbing Group team member with a Beacon account who authors, edits, and publishes guidelines. Full unilateral authority to publish their own content — no superadmin approval step. Per-Space viewer/editor/admin roles govern internal collaboration rights, not publishing rights. Job-to-be-done: turn "how this feature works" into a visual, screenshot-annotated guideline in under 5 minutes, using a rich-text block editor plus an in-editor screenshot annotation tool.
- **Viewer (public, primary)** — an end user of Dibimbing's products reading published guidelines on a public help-center-style site. No account, anonymous, read-only. Job-to-be-done: self-serve an answer to "how do I do X" without contacting support.
- **New hire (internal, secondary)** — uses Beacon's internal-only content as an onboarding reference.

## Product Purpose

Beacon is an internal documentation platform (GitBook/Notion-style) that centralizes guideline authoring across all of Dibimbing Group's platforms (product, mobile, internal dashboards, etc.). It exists because guideline creation is currently scattered (Google Docs, Slack, personal Notion) and visual documentation is slow, requiring a round-trip through external tools (Figma/Photoshop) to annotate screenshots before pasting them in. Success means: guideline creation drops from a slow multi-tool process to under 5 minutes, and published guidelines measurably help Viewers self-serve (target ≥75% "was this helpful" yes-rate).

## Positioning

The unifying mechanism a neighboring generic doc tool (Notion, GitBook) could not truthfully copy without rebuilding around it: **Screenshot + Annotation + Description is one atomic, reusable block type**, not a screenshot pasted next to separately-written prose. Annotation (box/arrow/marker/label/blur) happens in-editor on Fabric.js, stored as a JSON layer decoupled from the source image, so it can be re-edited without re-uploading. No other tool in Dibimbing's current toolchain offers annotate-in-place.

## Operating Context

- **Authoring workflow:** User opens/creates a Page inside a Space (nested Space → Page → Sub-page tree), writes with a Notion-like block editor (BlockNote: headings, lists, checklists, tables, code, quotes, dividers, slash-command block insertion), drags/pastes/uploads screenshots, annotates them in-canvas, adds a description in the same block, and autosaves continuously (no explicit save action; must survive network/crash without data loss).
- **Publishing workflow:** a Page defaults to internal/private. Publishing is an explicit, separate action taken unilaterally by the page's author/editor — no approval gate. Published pages render on a public, anonymous, read-only site; the author can keep editing privately and Viewers see the last published snapshot until an explicit "Update" re-publish. Unpublish is available at any time.
- **Multi-tenant/domain workflow:** Dibimbing Group operates multiple business lines (Dibimbing, Cakrawala University, more later), each an `Organization` with its own independently-branded custom domain (e.g. `docs.dibimbing.id`, `docs.cakrawala.ac.id`), resolved by incoming Host header via Vercel for Platforms + Next.js Middleware. Content never crosses Organizations.
- **Reading workflow (Viewer):** anonymous visitor lands on a public help-center site scoped to one Organization's domain, browses/searches a simplified nav/TOC, reads a guideline (including annotated screenshots, with internal-only elements like comments/mentions/edit history stripped), and can answer a lightweight "Was this helpful?" (yes/no + optional free text) at the end of the page.
- **Collaboration (v1):** comments per block/section with `@mention` notifications. No real-time co-editing in v1 (deferred); concurrent edits rely on last-write-wins autosave + Version History as the recovery path, not locking.

## Capabilities and Constraints

- Bahasa Indonesia only for both authoring UI and public content in Phase 1 — no i18n framework or per-locale content structure required yet.
- No custom backend API: all CRUD/auth/file-handling routes through Supabase directly (self-hosted) once Phase 1b begins; the only server-side code is one Next.js API route for S3 presigned upload URLs.
- Cost constraint is hard: every tool/library choice must be free/open-source or already-owned infra — this shaped the stack (BlockNote over TipTap's paid Collaboration/AI Toolkit tiers, self-hosted Supabase, existing company S3/Vercel) and is a durable constraint on any future dependency additions, not just historical rationale.
- **Current phase (Phase 1a) is pure frontend UI-slicing against typed mock data — no backend, no Supabase/S3 wiring exists yet.** Both the User (authoring) and Viewer (public) experiences must be sliced from the start since they are meaningfully different UIs on the same content model.
- Non-goals: not a project-management tool, not a video editor (static-image annotation only), not a Figma replacement, no third-party integrations (Slack/SSO) in Phase 1.
- Editor must remain responsive under fast typing with no perceptible input lag, even on pages with many blocks/annotated screenshots.

## Brand Commitments

- Product name: **Beacon**. Company: **Dibimbing Group** (primary business lines: Dibimbing, Cakrawala University — each gets independently-branded public-site theming per Organization, out of scope for the internal-authoring visual system itself).
- The user has volunteered a binding visual direction for this design system: dark-mode-primary, near-black background with a blue undertone, a neon-green primary anchored to `#D6FD91`, built as shadcn/ui-compatible OKLCH tokens via tweakcn — full detail lives in DESIGN.md, not restated here.
- A reference screenshot was announced as the primary visual/stylistic reference (layout density, component shapes, polish) but did not arrive as an attachment in the same message; DESIGN.md proceeds on the brief's explicit values and flags where screenshot confirmation is still pending.

## Evidence on Hand

- `PROJECT.md` and `PRD.md` at the repo root are the authoritative, "Final"-status product spec and PRD (v3.1) — treat them as ground truth for scope, data model, and roadmap.
- No existing code, assets, logos, or screenshots exist in this repository yet (verified: repo contains only `PRD.md` and `PROJECT.md`, no `apps/`, no git history). Any visual maturity implied by prior session notes does not match current disk state and must not be assumed.
- No public branding/theming decisions exist yet for the per-Organization public sites (explicitly deferred in PROJECT.md §5.5) — this design system covers the shared authoring product and the public reading template's structure, not per-Organization brand skinning.

## Product Principles

1. **Speed to write** — blank page to a complete, screenshot-annotated guideline in under 5 minutes.
2. **Zero context-switch** — writing, screenshots, and annotation live in one editor; no app-switching.
3. **Reliability first** — never lose a User's writing to a failed save or crash.
4. **Consistent & scalable structure** — the Space/Page tree must scale across many platforms without becoming messy.
5. **Calm density for a writing tool** — Beacon is read and written in for long stretches; bold color identity must punctuate, not fatigue.

## Accessibility & Inclusion

WCAG contrast is an explicit, non-negotiable requirement for the color system: the neon-green primary must be checked per-tone for text-safe vs. accent-only use against the near-black background, and DESIGN.md must document which tones pass for body text and which are accent/highlight-only. No other accessibility standard was specified beyond this.
