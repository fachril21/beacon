import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicHomeContent } from "./public-home-content";
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
  usePublicOrgContext: () => ({ organization, basePath: "/public" }),
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

describe("PublicHomeContent", () => {
  it("shows the empty state when nothing is published", () => {
    mockUsePublicToc.mockReturnValue([]);
    render(<PublicHomeContent />);
    expect(screen.getByText("Belum ada panduan yang dipublikasikan")).toBeInTheDocument();
  });

  it("renders a child page nested under its parent, not as a flat sibling list", () => {
    const parent = makePage({ id: "parent", title: "Getting Started", slug: "getting-started" });
    const child = makePage({ id: "child", title: "Step One", slug: "step-one", parentPageId: "parent" });

    mockUsePublicToc.mockReturnValue([{ space, pages: [{ page: parent, children: [{ page: child, children: [] }] }] }]);
    render(<PublicHomeContent />);

    const links = screen.getAllByRole("link");
    const linkNames = links.map((link) => link.textContent);
    expect(linkNames.indexOf("Getting Started")).toBeLessThan(linkNames.indexOf("Step One"));
  });

  it("indents a child page further than its parent, reflecting the editor's tree depth", () => {
    const parent = makePage({ id: "parent", title: "Getting Started", slug: "getting-started" });
    const child = makePage({ id: "child", title: "Step One", slug: "step-one", parentPageId: "parent" });

    mockUsePublicToc.mockReturnValue([{ space, pages: [{ page: parent, children: [{ page: child, children: [] }] }] }]);
    render(<PublicHomeContent />);

    const parentDepth = screen.getByRole("link", { name: "Getting Started" }).getAttribute("data-depth");
    const childDepth = screen.getByRole("link", { name: "Step One" }).getAttribute("data-depth");
    expect(Number(childDepth)).toBeGreaterThan(Number(parentDepth));
  });
});
