import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicPageView } from "./public-page-view";
import type { Page, Space, Organization, PageContent } from "@/lib/types";

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

const mockUsePublicPage = vi.fn();
vi.mock("@/hooks/use-public-content", () => ({
  usePublicPage: (pageSlug: string, organizationId: string) => mockUsePublicPage(pageSlug, organizationId),
}));

const mockUsePublicSpace = vi.fn();
vi.mock("@/hooks/public-space-context", () => ({
  usePublicSpace: () => mockUsePublicSpace(),
}));

vi.mock("./public-page-content", () => ({
  PublicPageContent: () => <div data-testid="page-content" />,
}));

vi.mock("./feedback-widget", () => ({
  FeedbackWidget: () => <div data-testid="feedback-widget" />,
}));

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

function makePage(overrides: Partial<Page> & Pick<Page, "id" | "title" | "slug">): Page {
  return {
    spaceId: "space-1",
    parentPageId: null,
    order: 0,
    content: [],
    visibility: "publishable",
    isPublished: true,
    publishedContentSnapshot: null,
    publishedAt: "2026-01-02T00:00:00.000Z",
    createdByUserId: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const headingContent: PageContent = [
  { id: "h1", type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Ringkasan", styles: {} }], children: [] },
  { id: "h2", type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Langkah 1", styles: {} }], children: [] },
] as unknown as PageContent;

function makeResult(page: Page) {
  return { page, space };
}

describe("PublicPageView", () => {
  it('shows the "page no longer available" state when the page could not be resolved', () => {
    mockUsePublicPage.mockReturnValue(null);
    mockUsePublicSpace.mockReturnValue(null);
    render(<PublicPageView pageSlug="missing" />);
    expect(screen.getByText(/tidak tersedia/i)).toBeInTheDocument();
  });

  it('renders a breadcrumb, "Diperbarui" date, and never an author name', () => {
    const page = makePage({
      id: "page-1",
      title: "Cara login",
      slug: "cara-login",
      publishedContentSnapshot: { title: "Cara login", content: [], screenshotBlocks: {}, publishedAt: "2026-01-02T00:00:00.000Z" },
    });
    mockUsePublicPage.mockReturnValue(makeResult(page));
    mockUsePublicSpace.mockReturnValue({ space, pages: [{ page, children: [] }] });

    render(<PublicPageView pageSlug="cara-login" />);

    const breadcrumb = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(breadcrumb).toHaveTextContent("Dibimbing Docs");
    expect(breadcrumb).toHaveTextContent("Aplikasi Mobile");
    expect(screen.getByText(/Diperbarui/)).toBeInTheDocument();
    expect(screen.queryByText(/oleh|author|penulis/i)).not.toBeInTheDocument();
  });

  it('lists headings from the published snapshot under "Di halaman ini"', () => {
    const page = makePage({
      id: "page-1",
      title: "Cara login",
      slug: "cara-login",
      publishedContentSnapshot: { title: "Cara login", content: headingContent, screenshotBlocks: {}, publishedAt: "2026-01-02T00:00:00.000Z" },
    });
    mockUsePublicPage.mockReturnValue(makeResult(page));
    mockUsePublicSpace.mockReturnValue({ space, pages: [{ page, children: [] }] });

    render(<PublicPageView pageSlug="cara-login" />);

    const tocNavs = screen.getAllByRole("navigation", { name: "Di halaman ini" });
    expect(tocNavs.length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ringkasan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Langkah 1").length).toBeGreaterThan(0);
  });

  it("renders previous/next cards from the Space's page order", () => {
    const previous = makePage({ id: "p1", title: "Pendahuluan", slug: "pendahuluan" });
    const current = makePage({
      id: "p2",
      title: "Cara login",
      slug: "cara-login",
      publishedContentSnapshot: { title: "Cara login", content: [], screenshotBlocks: {}, publishedAt: "2026-01-02T00:00:00.000Z" },
    });
    const next = makePage({ id: "p3", title: "Reset kata sandi", slug: "reset-kata-sandi" });
    mockUsePublicPage.mockReturnValue(makeResult(current));
    mockUsePublicSpace.mockReturnValue({
      space,
      pages: [{ page: previous, children: [] }, { page: current, children: [] }, { page: next, children: [] }],
    });

    render(<PublicPageView pageSlug="cara-login" />);

    expect(screen.getByRole("link", { name: /Pendahuluan/ })).toHaveAttribute("href", "/public/dibimbing/pages/pendahuluan");
    expect(screen.getByRole("link", { name: /Reset kata sandi/ })).toHaveAttribute("href", "/public/dibimbing/pages/reset-kata-sandi");
  });
});
