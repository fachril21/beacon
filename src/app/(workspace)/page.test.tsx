import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WorkspaceHomePage from "./page";
import { emptyDoc } from "@/lib/mock/blocknote-content";
import type { Organization, Page, Space } from "@/lib/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: { id: "user-1", name: "Fachril Zulfidar" } }) }));

let mockSpaces: Space[] = [];
vi.mock("@/hooks/use-spaces", () => ({ useOrganizationSpaces: () => mockSpaces, useCreateSpace: () => vi.fn() }));

let mockOrganization: Organization | undefined;
vi.mock("@/hooks/use-organizations", () => ({ useCurrentOrganization: () => mockOrganization }));

let mockPages: Page[] = [];
const mockCreatePage = vi.fn();
vi.mock("@/hooks/use-pages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-pages")>();
  return {
    ...actual,
    usePages: () => mockPages,
    useCreatePage: () => mockCreatePage,
  };
});

let mockUnreadCount = 0;
vi.mock("@/hooks/use-notifications", () => ({ useUnreadNotificationCount: () => mockUnreadCount }));

vi.mock("@/components/workspace/space-card", () => ({
  SpaceCard: ({ space }: { space: Space }) => <div>{space.name}</div>,
}));

const baseOrganization: Organization = {
  id: "org-1",
  name: "Acme Inc",
  slug: "acme",
  domain: null,
  isDomainVerified: false,
  pendingDnsToken: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function makeSpace(overrides: Partial<Space>): Space {
  return {
    id: "space-1",
    organizationId: "org-1",
    name: "Aplikasi Mobile",
    slug: "test-space",
    category: null,
    isPublishable: false,
    createdByUserId: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makePage(overrides: Partial<Page>): Page {
  return {
    id: "page-1",
    spaceId: "space-1",
    parentPageId: null,
    title: "Onboarding",
    order: 0,
    content: [],
    visibility: "internal",
    slug: null,
    isPublished: false,
    publishedContentSnapshot: null,
    publishedAt: null,
    createdByUserId: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("WorkspaceHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrganization = { ...baseOrganization };
    mockSpaces = [];
    mockPages = [];
    mockUnreadCount = 0;
    mockCreatePage.mockResolvedValue(makePage({ id: "new-page" }));
  });

  it("shows the greeting with the User's first name", () => {
    mockSpaces = [makeSpace({})];
    render(<WorkspaceHomePage />);
    expect(screen.getByRole("heading", { name: "Selamat datang, Fachril" })).toBeInTheDocument();
  });

  it("shows the create-Space empty state when the Organization has no Spaces", () => {
    render(<WorkspaceHomePage />);
    expect(screen.getByText("Buat Space pertama Anda")).toBeInTheDocument();
  });

  it("lists Spaces and hides Lanjutkan menulis when there are no pages yet", () => {
    mockSpaces = [makeSpace({ id: "space-1", name: "Aplikasi Mobile" }), makeSpace({ id: "space-2", name: "SOP Internal" })];
    render(<WorkspaceHomePage />);

    expect(screen.getByText("Aplikasi Mobile")).toBeInTheDocument();
    expect(screen.getByText("SOP Internal")).toBeInTheDocument();
    expect(screen.queryByText("Lanjutkan menulis")).not.toBeInTheDocument();
  });

  it("shows the 3 most recently updated pages under Lanjutkan menulis, scoped to this Org's Spaces", () => {
    mockSpaces = [makeSpace({ id: "space-1" })];
    mockPages = [
      makePage({ id: "old", title: "Lama", updatedAt: "2026-01-01T00:00:00.000Z" }),
      makePage({ id: "new", title: "Baru", updatedAt: "2026-02-01T00:00:00.000Z" }),
      makePage({ id: "other-org", title: "Bukan Space ini", spaceId: "space-other", updatedAt: "2026-03-01T00:00:00.000Z" }),
    ];
    render(<WorkspaceHomePage />);

    const heading = screen.getByText("Lanjutkan menulis");
    expect(heading).toBeInTheDocument();
    expect(screen.getByText("Baru")).toBeInTheDocument();
    expect(screen.getByText("Lama")).toBeInTheDocument();
    expect(screen.queryByText("Bukan Space ini")).not.toBeInTheDocument();
  });

  it("counts unpublished changes and unread notifications under Perlu perhatian", () => {
    mockSpaces = [makeSpace({ id: "space-1" })];
    mockUnreadCount = 4;
    mockPages = [
      makePage({
        id: "pending",
        isPublished: true,
        title: "A (diubah)",
        publishedContentSnapshot: { title: "A", content: emptyDoc(), screenshotBlocks: {}, publishedAt: "2026-01-01T00:00:00.000Z" },
      }),
      makePage({ id: "clean", isPublished: false, title: "B" }),
    ];
    render(<WorkspaceHomePage />);

    expect(screen.getByText("Perubahan belum dipublikasikan").nextSibling).toHaveTextContent("1");
    expect(screen.getByText("Notifikasi baru").nextSibling).toHaveTextContent("4");
  });

  it("opens the New Space dialog when Halaman baru is clicked with no Spaces yet", async () => {
    const user = userEvent.setup();
    render(<WorkspaceHomePage />);

    await user.click(screen.getByRole("button", { name: /halaman baru/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(mockCreatePage).not.toHaveBeenCalled();
  });

  it("creates a Page directly in the first Space and navigates when Halaman baru is clicked with a Space present", async () => {
    mockSpaces = [makeSpace({ id: "space-1" })];
    const user = userEvent.setup();
    render(<WorkspaceHomePage />);

    await user.click(screen.getByRole("button", { name: /halaman baru/i }));

    expect(mockCreatePage).toHaveBeenCalledWith({
      spaceId: "space-1",
      parentPageId: null,
      title: "Halaman tanpa judul",
      createdByUserId: "user-1",
    });
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledWith("/spaces/space-1/pages/new-page"));
  });
});
