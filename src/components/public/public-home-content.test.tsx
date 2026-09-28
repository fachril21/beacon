import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicHomeContent } from "./public-home-content";
import type { Space, Organization } from "@/lib/types";

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

const mockUsePublicSpaces = vi.fn();
vi.mock("@/hooks/use-public-content", () => ({
  usePublicSpaces: (organizationId: string) => mockUsePublicSpaces(organizationId),
}));

vi.mock("./public-search-command", () => ({ PublicSearchCommand: () => null }));

const space = (over: Partial<Space> & Pick<Space, "id" | "name" | "slug">): Space => ({
  organizationId: "org-1",
  category: null,
  isPublishable: true,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("PublicHomeContent (Space directory)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePublicSpaces.mockReturnValue({ spaces: [], recentPages: [] });
  });

  it("shows the empty state when no Space has published content", () => {
    render(<PublicHomeContent />);
    expect(screen.getByText("Belum ada panduan yang dipublikasikan")).toBeInTheDocument();
  });

  it("shows the search box, which opens PublicSearchCommand", () => {
    render(<PublicHomeContent />);
    expect(screen.getByRole("button", { name: /cari dokumentasi/i })).toBeInTheDocument();
  });

  it("renders one topic card per publishable Space, pointing at that Space's own page", () => {
    mockUsePublicSpaces.mockReturnValue({
      spaces: [
        { space: space({ id: "s1", name: "Aplikasi Mobile", slug: "aplikasi-mobile" }), publishedPageCount: 4 },
        { space: space({ id: "s2", name: "Onboarding Karyawan", slug: "onboarding-karyawan" }), publishedPageCount: 2 },
      ],
      recentPages: [],
    });
    render(<PublicHomeContent />);

    const mobile = screen.getByRole("link", { name: /Aplikasi Mobile/ });
    expect(mobile).toHaveAttribute("href", "/public/dibimbing/spaces/aplikasi-mobile");
    expect(screen.getByRole("link", { name: /Onboarding Karyawan/ })).toHaveAttribute(
      "href",
      "/public/dibimbing/spaces/onboarding-karyawan",
    );
  });

  it('shows a "Terbaru:" row (never "Populer") with the recently published page titles as links', () => {
    mockUsePublicSpaces.mockReturnValue({
      spaces: [{ space: space({ id: "s1", name: "Aplikasi Mobile", slug: "aplikasi-mobile" }), publishedPageCount: 1 }],
      recentPages: [
        { title: "Cara login", slug: "cara-login", publishedAt: "2026-01-02T00:00:00.000Z" },
        { title: "Reset kata sandi", slug: "reset-kata-sandi", publishedAt: "2026-01-01T00:00:00.000Z" },
      ],
    });
    render(<PublicHomeContent />);

    expect(screen.getByText("Terbaru:")).toBeInTheDocument();
    expect(screen.queryByText(/populer/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cara login" })).toHaveAttribute("href", "/public/dibimbing/pages/cara-login");
    expect(screen.getByRole("link", { name: "Reset kata sandi" })).toHaveAttribute(
      "href",
      "/public/dibimbing/pages/reset-kata-sandi",
    );
  });

  it("hides the Terbaru row when there are no recently published pages", () => {
    mockUsePublicSpaces.mockReturnValue({
      spaces: [{ space: space({ id: "s1", name: "Aplikasi Mobile", slug: "aplikasi-mobile" }), publishedPageCount: 1 }],
      recentPages: [],
    });
    render(<PublicHomeContent />);
    expect(screen.queryByText("Terbaru:")).not.toBeInTheDocument();
  });
});
