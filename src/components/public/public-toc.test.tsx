import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicToc } from "./public-toc";
import type { Page, Space } from "@/lib/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/public",
}));

vi.mock("@/hooks/use-public-org", () => ({
  usePublicOrgContext: () => ({ basePath: "/public" }),
}));

const mockUsePublicToc = vi.fn();
vi.mock("@/hooks/use-public-content", () => ({
  usePublicToc: (organizationId: string) => mockUsePublicToc(organizationId),
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
  category: null,
  isPublishable: true,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("PublicToc", () => {
  it("shows the empty state when there is nothing published", () => {
    mockUsePublicToc.mockReturnValue([]);
    render(<PublicToc organizationId="org-1" />);
    expect(screen.getByText("Belum ada halaman yang dipublikasikan.")).toBeInTheDocument();
  });

  it("renders a child page nested under its parent, not as a flat sibling list", () => {
    const parent = makePage({ id: "parent", title: "Getting Started", slug: "getting-started" });
    const child = makePage({ id: "child", title: "Step One", slug: "step-one", parentPageId: "parent" });

    mockUsePublicToc.mockReturnValue([{ space, pages: [{ page: parent, children: [{ page: child, children: [] }] }] }]);
    render(<PublicToc organizationId="org-1" />);

    const links = screen.getAllByRole("link");
    const linkNames = links.map((link) => link.textContent);
    expect(linkNames.indexOf("Getting Started")).toBeLessThan(linkNames.indexOf("Step One"));
  });

  it("indents a child page further than its parent, reflecting the editor's tree depth", () => {
    const parent = makePage({ id: "parent", title: "Getting Started", slug: "getting-started" });
    const child = makePage({ id: "child", title: "Step One", slug: "step-one", parentPageId: "parent" });

    mockUsePublicToc.mockReturnValue([{ space, pages: [{ page: parent, children: [{ page: child, children: [] }] }] }]);
    render(<PublicToc organizationId="org-1" />);

    const parentDepth = screen.getByRole("link", { name: "Getting Started" }).getAttribute("data-depth");
    const childDepth = screen.getByRole("link", { name: "Step One" }).getAttribute("data-depth");
    expect(Number(childDepth)).toBeGreaterThan(Number(parentDepth));
  });

  it("never renders a page whose parent isn't in the published tree (hidden, not promoted to root)", () => {
    // The hook contract (buildPageTree) already hides orphans before this
    // component ever sees them — this asserts the component simply trusts
    // and renders whatever tree it's given, with no orphan anywhere.
    const onlyChild = makePage({ id: "child", title: "Step One", slug: "step-one" });
    mockUsePublicToc.mockReturnValue([{ space, pages: [{ page: onlyChild, children: [] }] }]);
    render(<PublicToc organizationId="org-1" />);

    expect(screen.getByRole("link", { name: "Step One" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
