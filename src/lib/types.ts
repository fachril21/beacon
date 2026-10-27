/**
 * Core entity types for Beacon, matching PROJECT.md §9.4 field-for-field.
 * Stage 1 (Phase 1a) uses these against typed mock fixtures (src/lib/mock/).
 * Stage 2 swaps hook internals for real Supabase calls without changing these
 * shapes or any component — see PRD.md §7.
 */
import type { PartialBlock as BNPartialBlock } from "@blocknote/core";

/**
 * A Page's document content — BlockNote's block tree. Typed as `PartialBlock[]`
 * (not the stricter `Block[]`) so hand-authored fixtures don't need every
 * default prop spelled out; `editor.document` (a full `Block[]`) is always
 * assignable here, and this is exactly the shape `useCreateBlockNote({
 * initialContent })` expects when re-opening stored content.
 */
export type PageContent = BNPartialBlock[];

export type ID = string;
export type ISODateString = string;

// ---------------------------------------------------------------------------
// Organization — PROJECT.md §9.4, §5.5 multi-domain publishing
// ---------------------------------------------------------------------------

export interface Organization {
  id: ID;
  name: string;
  /** Platform-domain identity (/public/{slug}) — always set, auto-generated from name, independent of custom-domain verification. */
  slug: string;
  domain: string | null;
  isDomainVerified: boolean;
  /** DNS TXT record value the owner must add — present only while a domain add is pending verification (Flow 7a). */
  pendingDnsToken: string | null;
  createdAt: ISODateString;
}

export type OrganizationRole = "owner" | "admin" | "member";

// ---------------------------------------------------------------------------
// OrganizationMembership / OrganizationInvitation — the source of truth for
// User<->Organization access (org-refactor plan,
// docs/organization-permission-structure.md). A User can belong to more than
// one Organization; OWNER is unique per Organization at a time.
// ---------------------------------------------------------------------------

export interface OrganizationMembership {
  id: ID;
  organizationId: ID;
  userId: ID;
  role: OrganizationRole;
  createdAt: ISODateString;
}

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

/** role is deliberately narrower than OrganizationRole — 'owner' is never granted directly via invite. */
export type InvitableOrganizationRole = "admin" | "member";

export interface OrganizationInvitation {
  id: ID;
  organizationId: ID;
  email: string;
  role: InvitableOrganizationRole;
  token: string;
  invitedByUserId: ID;
  status: InvitationStatus;
  expiresAt: ISODateString;
  acceptedAt: ISODateString | null;
  createdAt: ISODateString;
}

// ---------------------------------------------------------------------------
// User — backed by auth.users (Stage 2) + profiles fields
// ---------------------------------------------------------------------------

export interface User {
  id: ID;
  email: string;
  name: string;
  avatarUrl: string | null;
  /** Convenience "last active Organization" pointer for the UI only — NOT authoritative for access. See OrganizationMembership. */
  organizationId: ID | null;
  createdAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Space — top-level container per platform, PROJECT.md §9.4
// ---------------------------------------------------------------------------

/**
 * One Page card inside a Space layout section. The Page itself stays a normal
 * `Page` row — the layout only stores its id, so renaming/deleting/editing a
 * Page never duplicates content.
 */
export interface SpaceLayoutPage {
  pageId: ID;
  /** Card width in a multi-column section. 1 is a normal card; 2–4 span more columns. */
  colSpan?: number;
}

/** One admin-authored section on the Space landing page (e.g. "Panduan"). */
export interface SpaceSection {
  id: string;
  title: string;
  description?: string;
  /** Number of columns the section's Page cards are arranged in (1–4). */
  columns: number;
  /** Ordered Page references. Order is the display order in every view. */
  pages: SpaceLayoutPage[];
}

/**
 * Persisted Space Builder layout. `version` leaves room for future shape
 * changes without guessing at older documents; readers that don't recognise
 * a version fall back to the automatic page tree.
 */
export interface SpaceLayout {
  version: 1;
  sections: SpaceSection[];
}

export interface Space {
  id: ID;
  organizationId: ID;
  name: string;
  /** Public URL slug (/public/{orgSlug}/spaces/{slug}) — assigned from the name on create, unique per Organization, stable afterward. */
  slug: string;
  /** Category shown as a kicker on Space summary cards (DESIGN.md §5.4) — e.g. "Aplikasi Mobile". */
  category: string | null;
  /** Space-level subtitle shown under the title in the workspace and on the public landing page. Empty when unset. */
  description?: string;
  /** Optional emoji shown beside the Space name. `null` renders no glyph at all (never a placeholder). */
  icon?: string | null;
  /** Admin-authored landing layout. `null`/missing means "not arranged yet" — readers fall back to the page tree. */
  layout?: SpaceLayout | null;
  /** Navigation setting: show the Page tree in the public Space sidebar. Defaults to true. */
  showPageList?: boolean;
  /** Per-Space "publishable" flag (PRD.md Flow 2 step 2) — default OFF/internal-only. */
  isPublishable: boolean;
  createdByUserId: ID;
  createdAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Permission — role scoped per Space, PROJECT.md §9.4
// ---------------------------------------------------------------------------

export type SpaceRole = "viewer" | "editor" | "admin";

export interface Permission {
  id: ID;
  spaceId: ID;
  userId: ID;
  role: SpaceRole;
}

// ---------------------------------------------------------------------------
// Page — belongs to a Space, supports nesting, PROJECT.md §9.4
// ---------------------------------------------------------------------------

export type PageVisibility = "internal" | "publishable";

/** Decoupled last-published copy of a Page's content — Viewers see this until "Update" (PRD.md §5.3). */
export interface PublishedContentSnapshot {
  title: string;
  content: PageContent;
  screenshotBlocks: Record<ID, ScreenshotBlock>;
  publishedAt: ISODateString;
}

export interface Page {
  id: ID;
  spaceId: ID;
  parentPageId: ID | null;
  title: string;
  /** Optional one-line summary under the title — empty string when the author left it blank. */
  description: string;
  /** Optional emoji beside the title wherever the Page is listed. `null` renders no emoji at all (never a placeholder glyph). */
  emoji: string | null;
  /** Sibling order within the same parent, for sidebar drag-and-drop reorder (Flow 2 step 5). */
  order: number;
  /** Live-draft BlockNote document — the truth source for the editor (PRD.md §5.1). */
  content: PageContent;
  visibility: PageVisibility;
  /** Public URL slug (/public/{orgSlug}/pages/{slug}) — null until first published; assigned by publish_page(), stable afterward. */
  slug: string | null;
  isPublished: boolean;
  publishedContentSnapshot: PublishedContentSnapshot | null;
  publishedAt: ISODateString | null;
  createdByUserId: ID;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Block — a unit of content within a Page, PROJECT.md §9.4
//
// Stage 1 modeling note (flagged assumption): ordinary text/heading/list/etc.
// blocks live inside `Page.content` as native BlockNote blocks — that JSON
// tree IS their "Block" representation, per PRD.md §5.1's truth-source rule,
// so no parallel per-paragraph row exists. The one Block subtype that needs
// to be a first-class, independently addressable entity is ScreenshotBlock
// (it owns non-text state — image ref + description —
// that must survive being re-opened without re-uploading, and that
// Comments/Version History need to reference by a stable id independent of
// BlockNote's own block ids). BlockType also enumerates every insertable
// block kind for the slash command menu (Flow 3 step 2).
// ---------------------------------------------------------------------------

export type BlockType =
  | "heading"
  | "paragraph"
  | "bulletList"
  | "numberedList"
  | "checklist"
  | "code"
  | "quote"
  | "table"
  | "divider"
  | "callout"
  | "button"
  | "columns"
  | "column"
  | "screenshot";

export interface Block {
  id: ID;
  pageId: ID;
  type: BlockType;
  order: number;
}

// ---------------------------------------------------------------------------
// Annotation — a single markup shape drawn on top of a ScreenshotBlock's
// image (numbered step markers, arrows, boxes, text labels). Coordinates are
// fractions (0..1) of the image's own width/height, not raw pixels, so a
// shape stays correctly positioned regardless of the display size the image
// is rendered at (see AnnotationOverlay's viewBox).
// ---------------------------------------------------------------------------

export type AnnotationShapeType = "marker" | "arrow" | "box" | "label";

export interface Annotation {
  id: ID;
  type: AnnotationShapeType;
  /** Placement order — also the number shown for a "marker" annotation. */
  order: number;
  color: string;
  x: number;
  y: number;
  /** Arrow endpoint (fraction of image width/height) — only set for type "arrow". */
  x2?: number;
  y2?: number;
  /** Box size (fraction of image width/height) — only set for type "box". */
  width?: number;
  height?: number;
  /** Free text — only set for type "label". */
  text?: string;
  /** Absolute SVG stroke width in the image's own pixel space. Undefined for annotations drawn before this field existed — renders at AnnotationOverlay's own computed default (see annotationStrokeWidth). */
  strokeWidth?: number;
}

// ---------------------------------------------------------------------------
// ScreenshotBlock — PROJECT.md §9.4 (the product's signature feature)
// ---------------------------------------------------------------------------

export interface ScreenshotBlock extends Block {
  type: "screenshot";
  /**
   * Stage 1: a local object URL (`URL.createObjectURL`) or a path under /public
   * for seeded fixtures. Stage 2: an S3-compatible object key (PRD.md §5.2).
   */
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  annotations: Annotation[];
  /** Plain text for Stage 1; could become rich text later — not specified by the brief. */
  description: string;
  altText: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Version — snapshot of a Page's content for history/rollback, PROJECT.md §9.4
// ---------------------------------------------------------------------------

export interface Version {
  id: ID;
  pageId: ID;
  title: string;
  content: PageContent;
  createdByUserId: ID;
  createdAt: ISODateString;
  /** True when this Version was itself created as a result of a restore (Flow 9 step 3 — restoring is never destructive). */
  isRestoreOf: ID | null;
}

// ---------------------------------------------------------------------------
// Comment — attached to a Block, PROJECT.md §9.4
// ---------------------------------------------------------------------------

export interface Comment {
  id: ID;
  pageId: ID;
  /** References a stable block-level id — either a ScreenshotBlock.id or a BlockNote top-level block's id. */
  blockId: ID;
  authorUserId: ID;
  body: string;
  mentionedUserIds: ID[];
  createdAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Feedback — attached to a published Page, PROJECT.md §9.4
// ---------------------------------------------------------------------------

export interface Feedback {
  id: ID;
  pageId: ID;
  helpful: boolean;
  comment: string | null;
  createdAt: ISODateString;
}

// ---------------------------------------------------------------------------
// Notification — a real notification sent when a User is @mentioned in a
// Comment (PRD.md US16.2). Not in PROJECT.md §9.4 (added during Stage 3,
// since no notification surface existed before Epic 16).
// ---------------------------------------------------------------------------

export interface Notification {
  id: ID;
  recipientUserId: ID;
  actorUserId: ID;
  pageId: ID;
  commentId: ID;
  isRead: boolean;
  createdAt: ISODateString;
  /** The tagging comment's text and block, joined in when notifications are loaded (absent if not readable). */
  commentBody?: string | null;
  commentBlockId?: string | null;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchResult {
  pageId: ID;
  /** Public URL slug — null for internal search results (unpublished Pages have none). */
  pageSlug: string | null;
  spaceId: ID;
  spaceName: string;
  pageTitle: string;
  snippet: string;
}
