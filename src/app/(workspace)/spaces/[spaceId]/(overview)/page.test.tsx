import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense, type ReactNode } from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import SpacePage from "./page";
import type { Page, Space, User } from "@/lib/types";

const paramsPromise = Promise.resolve({ spaceId: "space-1" });

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: { id: "user-1" } }) }));

let mockRole: "viewer" | "editor" | "admin" | null = "editor";
let mockSpace: Space | undefined;
vi.mock("@/hooks/use-spaces", () => ({
  useSpace: () => mockSpace,
  useSpaceRole: () => mockRole,
}));

let mockPages: Page[] = [];
const mockCreatePage = vi.fn();
const mockDeletePage = vi.fn(() => Promise.resolve());
vi.mock("@/hooks/use-pages", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-pages")>();
  return {
    ...actual,
    usePages: () => mockPages,
    useCreatePage: () => mockCreatePage,
    useDeletePage: () => mockDeletePage,
  };
});

let mockUsers: User[] = [];
vi.mock("@/hooks/use-users", () => ({ useUsers: () => mockUsers }));

const baseSpace: Space = {
  id: "space-1",
  organizationId: "org-1",
  name: "Aplikasi Mobile",
  slug: "test-space",
  category: null,
  isPublishable: true,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

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

const author: User = {
  id: "user-1",
  email: "admin@corp.id",
  name: "Admin Owner",
  avatarUrl: null,
  organizationId: "org-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

async function renderPage() {
  let utils!: ReturnType<typeof render>;
  await act(async () => {
    utils = render(
      <Suspense fallback={null}>
        <SpacePage params={paramsPromise} />
      </Suspense>,
    );
  });
  return utils;
}

describe("SpacePage Halaman tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = "editor";
    mockSpace = { ...baseSpace };
    mockUsers = [author];
    mockCreatePage.mockResolvedValue(makePage({ id: "new-page" }));
    mockDeletePage.mockResolvedValue(undefined);
  });

  it("shows the empty state with no pages in the Space", async () => {
    mockPages = [];
    await renderPage();
    expect(await screen.findByText("Belum ada halaman")).toBeInTheDocument();
  });

  it("lists pages with title, status, author, and relative time, indented by depth", async () => {
    mockPages = [
      makePage({ id: "parent", title: "Memulai", parentPageId: null, order: 0 }),
      makePage({ id: "child", title: "Instalasi", parentPageId: "parent", order: 0, isPublished: true }),
    ];
    await renderPage();

    expect(await screen.findByRole("link", { name: /memulai/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /instalasi/i })).toBeInTheDocument();
    expect(screen.getAllByText("Admin Owner")).toHaveLength(2);
    // "Draf"/"Dipublikasikan" each also label a segmented-filter button, so
    // both the filter and the row's status badge match — assert at least one.
    expect(screen.getAllByText("Draf").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dipublikasikan").length).toBeGreaterThan(0);
  });

  it("filters rows by title text", async () => {
    mockPages = [makePage({ id: "a", title: "Memulai" }), makePage({ id: "b", title: "Pembayaran" })];
    await renderPage();
    const user = userEvent.setup();

    await user.type(await screen.findByPlaceholderText("Cari halaman…"), "bayar");

    expect(screen.queryByRole("link", { name: /memulai/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pembayaran/i })).toBeInTheDocument();
  });

  it("filters rows by status via the segmented control", async () => {
    mockPages = [
      makePage({ id: "a", title: "Draf saja", isPublished: false }),
      makePage({ id: "b", title: "Sudah terbit", isPublished: true }),
    ];
    await renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Draf" }));

    expect(screen.getByRole("link", { name: /draf saja/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sudah terbit/i })).not.toBeInTheDocument();
  });

  it("shows a menu with Hapus for an editor and deletes the page on confirm", async () => {
    mockPages = [makePage({ id: "page-1", title: "Onboarding" })];
    await renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Menu halaman" }));
    await user.click(await screen.findByRole("menuitem", { name: "Hapus" }));
    await user.click(await screen.findByRole("button", { name: "Hapus" }));

    expect(mockDeletePage).toHaveBeenCalledWith("page-1");
  });

  it("hides the row menu entirely for a viewer", async () => {
    mockRole = "viewer";
    mockPages = [makePage({ id: "page-1", title: "Onboarding" })];
    await renderPage();
    await screen.findByRole("link", { name: /onboarding/i });
    expect(screen.queryByRole("button", { name: "Menu halaman" })).not.toBeInTheDocument();
  });

  it("creates a new Page and navigates to it from the empty state's action", async () => {
    mockPages = [];
    await renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /halaman baru/i }));

    expect(mockCreatePage).toHaveBeenCalledWith({
      spaceId: "space-1",
      parentPageId: null,
      title: "Halaman tanpa judul",
      createdByUserId: "user-1",
    });
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledWith("/spaces/space-1/pages/new-page"));
  });

  it("shows a toast and does not navigate if creating the page fails", async () => {
    mockPages = [];
    mockCreatePage.mockRejectedValueOnce(new Error("boom"));
    await renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /halaman baru/i }));

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
  });
});
