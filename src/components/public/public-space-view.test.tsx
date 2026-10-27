import { describe, it, expect, vi, beforeEach } from "vitest";
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
const mockUsePublicSpaceStatus = vi.fn();
vi.mock("@/hooks/public-space-context", () => ({
  usePublicSpace: () => mockUsePublicSpace(),
  usePublicSpaceStatus: () => mockUsePublicSpaceStatus(),
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
    description: "",
    emoji: null,
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePublicSpaceStatus.mockReturnValue("ready");
  });

  it("shows the 'not available' state when the slug resolved to no Space", () => {
    mockUsePublicSpace.mockReturnValue(null);
    render(<PublicSpaceView />);
    expect(screen.getByText(/tidak tersedia|no longer available|tidak ditemukan/i)).toBeInTheDocument();
  });

  it("shows a loading skeleton instead of the unavailable state while the Space resolves", () => {
    mockUsePublicSpace.mockReturnValue(null);
    mockUsePublicSpaceStatus.mockReturnValue("loading");

    render(<PublicSpaceView />);

    expect(screen.getByRole("status")).toHaveTextContent(/memuat space/i);
    expect(screen.queryByText(/tidak tersedia/i)).not.toBeInTheDocument();
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

  it("renders the admin-authored sections and description, in the saved order", () => {
    const first = makePage({ id: "first", title: "Penjelasan", slug: "penjelasan" });
    const second = makePage({ id: "second", title: "Dokumentasi", slug: "dokumentasi" });
    mockUsePublicSpace.mockReturnValue({
      space: {
        ...space,
        description: "Dokumentasi dan panduan penggunaan.",
        layout: {
          version: 1,
          sections: [
            { id: "s1", title: "Informasi Umum", columns: 2, pages: [{ pageId: "second" }, { pageId: "first" }] },
          ],
        },
      },
      pages: [
        { page: first, children: [] },
        { page: second, children: [] },
      ],
    });

    render(<PublicSpaceView />);

    expect(screen.getByRole("heading", { name: "Aplikasi Mobile" })).toBeInTheDocument();
    expect(screen.getByText("Dokumentasi dan panduan penggunaan.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Informasi Umum" })).toBeInTheDocument();
    const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.includes("/pages/"));
    expect(links.map((link) => link.textContent)).toEqual(["Dokumentasi", "Penjelasan"]);
  });

  it("never renders a Page referenced by the layout that the public query did not return", () => {
    const published = makePage({ id: "published", title: "Terbit", slug: "terbit" });
    mockUsePublicSpace.mockReturnValue({
      space: {
        ...space,
        layout: {
          version: 1,
          sections: [
            { id: "s1", title: "Bagian", columns: 1, pages: [{ pageId: "draft" }, { pageId: "published" }] },
          ],
        },
      },
      pages: [{ page: published, children: [] }],
    });

    render(<PublicSpaceView />);

    expect(screen.getByRole("link", { name: "Terbit" })).toBeInTheDocument();
    expect(screen.queryByText("Draf")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Draft" })).not.toBeInTheDocument();
  });
});
