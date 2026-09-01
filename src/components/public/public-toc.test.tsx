import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicToc } from "./public-toc";
import type { Page, Space } from "@/lib/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/public/dibimbing/spaces/mobile-app",
}));

vi.mock("@/hooks/use-public-org", () => ({
  usePublicOrgContext: () => ({ basePath: "/public/dibimbing" }),
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
  name: "Mobile App",
  slug: "mobile-app",
  category: null,
  isPublishable: true,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("PublicToc (single Space)", () => {
  it("renders nothing when there is no current Space (directory route)", () => {
    mockUsePublicSpace.mockReturnValue(null);
    const { container } = render(<PublicToc />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a back link to the Space directory", () => {
    mockUsePublicSpace.mockReturnValue({ space, pages: [] });
    render(<PublicToc />);
    expect(screen.getByRole("link", { name: /semua dokumentasi/i })).toHaveAttribute("href", "/public/dibimbing");
  });

  it("renders only the current Space's pages, nested by tree depth", () => {
    const parent = makePage({ id: "parent", title: "Getting Started", slug: "getting-started" });
    const child = makePage({ id: "child", title: "Step One", slug: "step-one", parentPageId: "parent" });
    mockUsePublicSpace.mockReturnValue({ space, pages: [{ page: parent, children: [{ page: child, children: [] }] }] });

    render(<PublicToc />);

    const parentLink = screen.getByRole("link", { name: "Getting Started" });
    const childLink = screen.getByRole("link", { name: "Step One" });
    expect(parentLink).toHaveAttribute("href", "/public/dibimbing/pages/getting-started");
    expect(Number(childLink.getAttribute("data-depth"))).toBeGreaterThan(Number(parentLink.getAttribute("data-depth")));
  });
});
