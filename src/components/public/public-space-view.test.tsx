import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicSpaceView } from "./public-space-view";
import type { Page, Space, Organization } from "@/lib/types";

const organization: Organization = {
  id: "org-1",
  name: "Dibimbing",
  slug: "dibimbing",
  domain: null,
  isDomainVerified: false,
  pendingDnsToken: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

vi.mock("@/hooks/use-public-org", () => ({
  usePublicOrgContext: () => ({ organization, basePath: "/public/dibimbing" }),
}));

const mockUsePublicSpace = vi.fn();
vi.mock("@/hooks/public-space-context", () => ({
  usePublicSpace: () => mockUsePublicSpace(),
}));

function makePage(overrides: Partial<Page> & Pick<Page, "id" | "title" | "slug">): Page {
  return {
    spaceId: "space-1",
    parentPageId: null,
    order: 0,
    content: [],
    visibility: "publishable",
    isPublished: true,
    publishedContentSnapshot: null,
    publishedAt: "2026-01-01T00:00:00.000Z",
    createdByUserId: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const space: Space = {
  id: "space-1",
  organizationId: "org-1",
  name: "Aplikasi Mobile",
  slug: "aplikasi-mobile",
  category: "Produk",
  isPublishable: true,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("PublicSpaceView", () => {
  it("shows the 'not available' state when the slug resolved to no Space", () => {
    mockUsePublicSpace.mockReturnValue(null);
    render(<PublicSpaceView />);
    expect(screen.getByText(/tidak tersedia|no longer available|tidak ditemukan/i)).toBeInTheDocument();
  });

  it("renders the Space name as the heading and only that Space's published pages", () => {
    const parent = makePage({ id: "parent", title: "Mulai", slug: "mulai" });
    const child = makePage({ id: "child", title: "Langkah 1", slug: "langkah-1", parentPageId: "parent" });
    mockUsePublicSpace.mockReturnValue({ space, pages: [{ page: parent, children: [{ page: child, children: [] }] }] });

    render(<PublicSpaceView />);

    expect(screen.getByRole("heading", { name: "Aplikasi Mobile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mulai" })).toHaveAttribute("href", "/public/dibimbing/pages/mulai");
    expect(screen.getByRole("link", { name: "Langkah 1" })).toHaveAttribute("href", "/public/dibimbing/pages/langkah-1");
  });
});
