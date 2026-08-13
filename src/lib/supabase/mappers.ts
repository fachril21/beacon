/**
 * Snake_case Postgres row -> camelCase app entity mappers, one per table in
 * supabase/migrations/20260806100000_initial_schema.sql. Every Stage 2 hook
 * goes through these instead of hand-rolling the same field renames inline,
 * so a column rename only needs updating in one place.
 */
import type {
  Organization,
  User,
  Space,
  Permission,
  PendingInvite,
  Page,
  PageContent,
  ScreenshotBlock,
  Version,
  PublishedContentSnapshot,
  Comment,
  Feedback,
  Notification,
} from "@/lib/types";

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  is_domain_verified: boolean;
  pending_dns_token: string | null;
  created_at: string;
}

export function mapOrganizationRow(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    domain: row.domain,
    isDomainVerified: row.is_domain_verified,
    pendingDnsToken: row.pending_dns_token,
    createdAt: row.created_at,
  };
}

export interface ProfileRow {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  organization_id: string;
  organization_role: string;
  created_at: string;
}

export function mapProfileRow(row: ProfileRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    organizationId: row.organization_id,
    organizationRole: row.organization_role as User["organizationRole"],
    createdAt: row.created_at,
  };
}

export interface SpaceRow {
  id: string;
  organization_id: string;
  name: string;
  category: string | null;
  is_publishable: boolean;
  created_by_user_id: string;
  created_at: string;
}

export function mapSpaceRow(row: SpaceRow): Space {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    category: row.category,
    isPublishable: row.is_publishable,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

export interface PermissionRow {
  id: string;
  space_id: string;
  user_id: string;
  role: string;
}

export function mapPermissionRow(row: PermissionRow): Permission {
  return {
    id: row.id,
    spaceId: row.space_id,
    userId: row.user_id,
    role: row.role as Permission["role"],
  };
}

export interface PendingInviteRow {
  id: string;
  space_id: string;
  email: string;
  role: string;
  invited_by_user_id: string;
  created_at: string;
}

export function mapPendingInviteRow(row: PendingInviteRow): PendingInvite {
  return {
    id: row.id,
    spaceId: row.space_id,
    email: row.email,
    role: row.role as PendingInvite["role"],
    invitedByUserId: row.invited_by_user_id,
    createdAt: row.created_at,
  };
}

export interface PageRow {
  id: string;
  space_id: string;
  parent_page_id: string | null;
  title: string;
  order: number;
  content: PageContent;
  visibility: string;
  slug: string | null;
  is_published: boolean;
  published_content_snapshot: PublishedContentSnapshot | null;
  published_at: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export function mapPageRow(row: PageRow): Page {
  return {
    id: row.id,
    spaceId: row.space_id,
    parentPageId: row.parent_page_id,
    title: row.title,
    order: row.order,
    content: row.content,
    visibility: row.visibility as Page["visibility"],
    slug: row.slug,
    isPublished: row.is_published,
    publishedContentSnapshot: row.published_content_snapshot,
    publishedAt: row.published_at,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ScreenshotBlockRow {
  id: string;
  page_id: string;
  order: number;
  image_object_key: string;
  image_width: number;
  image_height: number;
  annotation_json: ScreenshotBlock["annotationJson"];
  description: string;
  alt_text: string | null;
  created_at: string;
  updated_at: string;
}

export function mapScreenshotBlockRow(row: ScreenshotBlockRow): ScreenshotBlock {
  return {
    id: row.id,
    pageId: row.page_id,
    type: "screenshot",
    order: row.order,
    imageUrl: row.image_object_key,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    annotationJson: row.annotation_json,
    description: row.description,
    altText: row.alt_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface VersionRow {
  id: string;
  page_id: string;
  title: string;
  content: PageContent;
  created_by_user_id: string;
  created_at: string;
  is_restore_of: string | null;
}

export function mapVersionRow(row: VersionRow): Version {
  return {
    id: row.id,
    pageId: row.page_id,
    title: row.title,
    content: row.content,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    isRestoreOf: row.is_restore_of,
  };
}

export interface CommentRow {
  id: string;
  page_id: string;
  block_id: string;
  author_user_id: string;
  body: string;
  mentioned_user_ids: string[];
  created_at: string;
}

export function mapCommentRow(row: CommentRow): Comment {
  return {
    id: row.id,
    pageId: row.page_id,
    blockId: row.block_id,
    authorUserId: row.author_user_id,
    body: row.body,
    mentionedUserIds: row.mentioned_user_ids,
    createdAt: row.created_at,
  };
}

export interface FeedbackRow {
  id: string;
  page_id: string;
  helpful: boolean;
  comment: string | null;
  created_at: string;
}

export function mapFeedbackRow(row: FeedbackRow): Feedback {
  return {
    id: row.id,
    pageId: row.page_id,
    helpful: row.helpful,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

export interface NotificationRow {
  id: string;
  recipient_user_id: string;
  actor_user_id: string;
  page_id: string;
  comment_id: string;
  is_read: boolean;
  created_at: string;
}

export function mapNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    actorUserId: row.actor_user_id,
    pageId: row.page_id,
    commentId: row.comment_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}
