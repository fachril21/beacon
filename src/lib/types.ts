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

export interface Space {
  id: ID;
  organizationId: ID;
  name: string;
  /** Category shown as a kicker on Space summary cards (DESIGN.md §5.4) — e.g. "Aplikasi Mobile". */
  category: string | null;
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
// (it owns non-text state — image ref + annotation layer + description —
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
  | "screenshot";

export interface Block {
  id: ID;
  pageId: ID;
  type: BlockType;
  order: number;
}

// ---------------------------------------------------------------------------
// ScreenshotBlock — PROJECT.md §9.4 (the product's signature feature)
// ---------------------------------------------------------------------------

export type AnnotationToolType = "box" | "arrow" | "marker" | "label" | "blur";

/** Fabric.js canvas JSON, serialized via canvas.toJSON() — opaque to app code beyond this shape. */
export interface AnnotationJson {
  version: string;
  objects: Record<string, unknown>[];
  /** Next number to preview on the numbered-marker tool (DESIGN.md §6.3). */
  nextMarkerNumber: number;
}

export interface ScreenshotBlock extends Block {
  type: "screenshot";
  /**
   * Stage 1: a local object URL (`URL.createObjectURL`) or a path under /public
   * for seeded fixtures. Stage 2: an S3/MinIO object key (PRD.md §5.2).
   */
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  annotationJson: AnnotationJson | null;
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
