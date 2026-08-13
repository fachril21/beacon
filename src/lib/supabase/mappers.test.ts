import { describe, it, expect } from "vitest";
import { emptyDoc } from "@/lib/mock/blocknote-content";
import {
  mapOrganizationRow,
  mapProfileRow,
  mapSpaceRow,
  mapPermissionRow,
  mapPendingInviteRow,
  mapPageRow,
  mapScreenshotBlockRow,
  mapVersionRow,
} from "./mappers";

describe("mapOrganizationRow", () => {
  it("maps snake_case DB columns to the Organization shape", () => {
    const row = {
      id: "org-1",
      name: "Dibimbing",
      slug: "dibimbing",
      domain: "docs.dibimbing.id",
      is_domain_verified: true,
      pending_dns_token: null,
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(mapOrganizationRow(row)).toEqual({
      id: "org-1",
      name: "Dibimbing",
      slug: "dibimbing",
      domain: "docs.dibimbing.id",
      isDomainVerified: true,
      pendingDnsToken: null,
      createdAt: "2026-01-01T00:00:00Z",
    });
  });
});

describe("mapProfileRow", () => {
  it("maps a profiles row to the User shape", () => {
    const row = {
      id: "user-1",
      email: "a@example.com",
      name: "Ada",
      avatar_url: null,
      organization_id: "org-1",
      organization_role: "owner",
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(mapProfileRow(row)).toEqual({
      id: "user-1",
      email: "a@example.com",
      name: "Ada",
      avatarUrl: null,
      organizationId: "org-1",
      organizationRole: "owner",
      createdAt: "2026-01-01T00:00:00Z",
    });
  });
});

describe("mapSpaceRow", () => {
  it("maps a spaces row to the Space shape", () => {
    const row = {
      id: "space-1",
      organization_id: "org-1",
      name: "Mobile App",
      category: "Aplikasi Mobile",
      is_publishable: false,
      created_by_user_id: "user-1",
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(mapSpaceRow(row)).toEqual({
      id: "space-1",
      organizationId: "org-1",
      name: "Mobile App",
      category: "Aplikasi Mobile",
      isPublishable: false,
      createdByUserId: "user-1",
      createdAt: "2026-01-01T00:00:00Z",
    });
  });
});

describe("mapPermissionRow", () => {
  it("maps a permissions row to the Permission shape", () => {
    const row = { id: "perm-1", space_id: "space-1", user_id: "user-1", role: "admin" };
    expect(mapPermissionRow(row)).toEqual({ id: "perm-1", spaceId: "space-1", userId: "user-1", role: "admin" });
  });
});

describe("mapPendingInviteRow", () => {
  it("maps a pending_invites row to the PendingInvite shape", () => {
    const row = {
      id: "invite-1",
      space_id: "space-1",
      email: "b@example.com",
      role: "viewer",
      invited_by_user_id: "user-1",
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(mapPendingInviteRow(row)).toEqual({
      id: "invite-1",
      spaceId: "space-1",
      email: "b@example.com",
      role: "viewer",
      invitedByUserId: "user-1",
      createdAt: "2026-01-01T00:00:00Z",
    });
  });
});

describe("mapPageRow", () => {
  it("maps a pages row to the Page shape, defaulting a null snapshot", () => {
    const row = {
      id: "page-1",
      space_id: "space-1",
      parent_page_id: null,
      title: "Getting started",
      order: 0,
      content: emptyDoc(),
      visibility: "internal",
      slug: null,
      is_published: false,
      published_content_snapshot: null,
      published_at: null,
      created_by_user_id: "user-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };
    expect(mapPageRow(row)).toEqual({
      id: "page-1",
      spaceId: "space-1",
      parentPageId: null,
      title: "Getting started",
      order: 0,
      content: emptyDoc(),
      visibility: "internal",
      slug: null,
      isPublished: false,
      publishedContentSnapshot: null,
      publishedAt: null,
      createdByUserId: "user-1",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    });
  });
});

describe("mapScreenshotBlockRow", () => {
  it("maps a screenshot_blocks row to the ScreenshotBlock shape", () => {
    const row = {
      id: "shot-1",
      page_id: "page-1",
      order: 0,
      image_object_key: "org-1/space-1/page-1/shot-1.png",
      image_width: 800,
      image_height: 600,
      annotation_json: null,
      description: "",
      alt_text: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    expect(mapScreenshotBlockRow(row)).toEqual({
      id: "shot-1",
      pageId: "page-1",
      type: "screenshot",
      order: 0,
      imageUrl: "org-1/space-1/page-1/shot-1.png",
      imageWidth: 800,
      imageHeight: 600,
      annotationJson: null,
      description: "",
      altText: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
  });
});

describe("mapVersionRow", () => {
  it("maps a versions row to the Version shape", () => {
    const row = {
      id: "version-1",
      page_id: "page-1",
      title: "Getting started",
      content: emptyDoc(),
      created_by_user_id: "user-1",
      created_at: "2026-01-01T00:00:00Z",
      is_restore_of: null,
    };
    expect(mapVersionRow(row)).toEqual({
      id: "version-1",
      pageId: "page-1",
      title: "Getting started",
      content: emptyDoc(),
      createdByUserId: "user-1",
      createdAt: "2026-01-01T00:00:00Z",
      isRestoreOf: null,
    });
  });
});
