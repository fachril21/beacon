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

const space = (over: Partial<Space> & Pick<Space, "id" | "name" | "slug">): Space => ({
  organizationId: "org-1",
  category: null,
  isPublishable: true,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("PublicHomeContent (Space directory)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the empty state when no Space has published content", () => {
    mockUsePublicSpaces.mockReturnValue([]);
    render(<PublicHomeContent />);
    expect(screen.getByText("Belum ada panduan yang dipublikasikan")).toBeInTheDocument();
  });

  it("renders one link per publishable Space, pointing at that Space's own page", () => {
    mockUsePublicSpaces.mockReturnValue([
      { space: space({ id: "s1", name: "Aplikasi Mobile", slug: "aplikasi-mobile" }), publishedPageCount: 4 },
      { space: space({ id: "s2", name: "Onboarding Karyawan", slug: "onboarding-karyawan" }), publishedPageCount: 2 },
    ]);
    render(<PublicHomeContent />);

    const mobile = screen.getByRole("link", { name: /Aplikasi Mobile/ });
    expect(mobile).toHaveAttribute("href", "/public/dibimbing/spaces/aplikasi-mobile");
    expect(screen.getByRole("link", { name: /Onboarding Karyawan/ })).toHaveAttribute(
      "href",
      "/public/dibimbing/spaces/onboarding-karyawan",
    );
  });

  it("does not render any individual page links on the directory (Spaces are not mixed together)", () => {
    mockUsePublicSpaces.mockReturnValue([
      { space: space({ id: "s1", name: "Aplikasi Mobile", slug: "aplikasi-mobile" }), publishedPageCount: 4 },
    ]);
    render(<PublicHomeContent />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/public/dibimbing/spaces/aplikasi-mobile");
  });
});
