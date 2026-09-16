import { describe, it, expect } from "vitest";
import { emptyDoc } from "@/lib/mock/blocknote-content";
import {
  mapOrganizationRow,
  mapProfileRow,
  mapSpaceRow,
  mapPermissionRow,
  mapOrganizationMembershipRow,
  mapOrganizationInvitationRow,
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
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(mapProfileRow(row)).toEqual({
      id: "user-1",
      email: "a@example.com",
      name: "Ada",
      avatarUrl: null,
      organizationId: "org-1",
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
      slug: "mobile-app",
      category: "Aplikasi Mobile",
      is_publishable: false,
      created_by_user_id: "user-1",
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(mapSpaceRow(row)).toEqual({
      id: "space-1",
      organizationId: "org-1",
      name: "Mobile App",
      slug: "mobile-app",
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

describe("mapOrganizationMembershipRow", () => {
  it("maps an organization_memberships row to the OrganizationMembership shape", () => {
    const row = { id: "mem-1", organization_id: "org-1", user_id: "user-1", role: "owner", created_at: "2026-01-01T00:00:00Z" };
    expect(mapOrganizationMembershipRow(row)).toEqual({
      id: "mem-1",
      organizationId: "org-1",
      userId: "user-1",
      role: "owner",
      createdAt: "2026-01-01T00:00:00Z",
    });
  });
});

describe("mapOrganizationInvitationRow", () => {
  it("maps an organization_invitations row to the OrganizationInvitation shape", () => {
    const row = {
      id: "invite-1",
      organization_id: "org-1",
      email: "b@example.com",
      role: "member",
      token: "tok-abc",
      invited_by_user_id: "user-1",
      status: "pending",
      expires_at: "2026-01-08T00:00:00Z",
      accepted_at: null,
      created_at: "2026-01-01T00:00:00Z",
    };
    expect(mapOrganizationInvitationRow(row)).toEqual({
      id: "invite-1",
      organizationId: "org-1",
      email: "b@example.com",
      role: "member",
      token: "tok-abc",
      invitedByUserId: "user-1",
      status: "pending",
      expiresAt: "2026-01-08T00:00:00Z",
      acceptedAt: null,
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
      annotations: [],
      description: "",
      altText: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    });
  });

  it("maps a null annotation_json column to an empty annotations array, not null", () => {
    const row = {
      id: "shot-1",
      page_id: "page-1",
      order: 0,
      image_object_key: "k.png",
      image_width: 800,
      image_height: 600,
      annotation_json: null,
      description: "",
      alt_text: null,
      created_at: "t",
      updated_at: "t",
    };
    expect(mapScreenshotBlockRow(row).annotations).toEqual([]);
  });

  it("maps a populated annotation_json column to structured Annotation objects, unchanged", () => {
    const row = {
      id: "shot-1",
      page_id: "page-1",
      order: 0,
      image_object_key: "k.png",
      image_width: 800,
      image_height: 600,
      annotation_json: [
        { id: "ann-1", type: "box" as const, order: 1, color: "#ff0000", x: 0.1, y: 0.2, width: 0.3, height: 0.15 },
        { id: "ann-2", type: "marker" as const, order: 2, color: "#00ff00", x: 0.5, y: 0.5 },
      ],
      description: "",
      alt_text: null,
      created_at: "t",
      updated_at: "t",
    };
    expect(mapScreenshotBlockRow(row).annotations).toEqual([
      { id: "ann-1", type: "box", order: 1, color: "#ff0000", x: 0.1, y: 0.2, width: 0.3, height: 0.15 },
      { id: "ann-2", type: "marker", order: 2, color: "#00ff00", x: 0.5, y: 0.5 },
    ]);
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
