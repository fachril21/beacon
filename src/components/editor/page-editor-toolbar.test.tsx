import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageEditorToolbar } from "./page-editor-toolbar";
import type { Page, Space } from "@/lib/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

vi.mock("@/hooks/use-organizations", () => ({
  useOrganization: () => ({ id: "org-1", slug: "test-org", isDomainVerified: false }),
}));

const mockDeletePage = vi.fn(() => Promise.resolve());
const mockPublish = vi.fn(() =>
  Promise.resolve({ id: "page-1", slug: "untitled", isPublished: true } as Partial<Page> as Page),
);
vi.mock("@/hooks/use-pages", () => ({
  usePublishActions: () => ({ publish: mockPublish, update: vi.fn(), unpublish: vi.fn() }),
  useDeletePage: () => mockDeletePage,
  hasUnpublishedChanges: () => mockHasUnpublishedChanges(),
  getPageStatus: (page: Page) => (page.isPublished ? (mockHasUnpublishedChanges() ? "pending" : "published") : "draft"),
}));

const mockHasUnpublishedChanges = vi.fn(() => false);

const space: Space = {
  id: "space-1",
  organizationId: "org-1",
  name: "Test Space",
  slug: "test-space",
  category: null,
  isPublishable: true,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const draftPage: Page = {
  id: "page-1",
  spaceId: "space-1",
  parentPageId: null,
  title: "Untitled",
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
};

function renderToolbar(role: "viewer" | "editor" | "admin" | null) {
  return render(
    <PageEditorToolbar page={draftPage} space={space} title={draftPage.title} saveStatus="idle" role={role} />,
  );
}

describe("PageEditorToolbar publish gate (platform-domain publishing)", () => {
  it("enables Publish for a publishable Space even when the Organization has no verified custom domain", () => {
    renderToolbar("editor");
    const publishButton = screen.getByRole("button", { name: "Publikasikan" });
    expect(publishButton).not.toBeDisabled();
  });

  it("disables Publish (with an explanatory tooltip) when the Space itself is not publishable, regardless of domain status", () => {
    render(
      <PageEditorToolbar
        page={draftPage}
        space={{ ...space, isPublishable: false }}
        title={draftPage.title}
        saveStatus="idle"
        role="editor"
      />,
    );
    expect(screen.getByRole("button", { name: "Publikasikan" })).toBeDisabled();
  });

  it("links 'Lihat halaman publik' to the platform-domain slug URL from the freshly-published Page, not a stale UUID URL", async () => {
    mockToastSuccess.mockClear();
    mockPublish.mockClear();
    const user = userEvent.setup();
    renderToolbar("editor");

    await user.click(screen.getByRole("button", { name: "Publikasikan" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Publikasikan" }));

    await vi.waitFor(() => expect(mockPublish).toHaveBeenCalledWith("page-1"));
    await vi.waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());

    const [, options] = mockToastSuccess.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
    options.action.onClick();
    expect(mockPush).toHaveBeenCalledWith("/public/test-org/pages/untitled");
  });

  it("shows the real failure reason in the error toast when publishing fails", async () => {
    mockToastError.mockClear();
    mockPublish.mockRejectedValueOnce({ code: "42501", message: "permission denied" });
    const user = userEvent.setup();
    renderToolbar("editor");

    await user.click(screen.getByRole("button", { name: "Publikasikan" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Publikasikan" }));

    await vi.waitFor(() => expect(mockToastError).toHaveBeenCalled());
    const [message, options] = mockToastError.mock.calls[0] as [string, { description?: string }];
    expect(message).toMatch(/gagal memublikasikan/i);
    expect(options?.description).toMatch(/izin/i);
  });

  it("never sends the user to the private workspace when the published page has no slug", async () => {
    mockToastSuccess.mockClear();
    mockPush.mockClear();
    mockPublish.mockResolvedValueOnce({ id: "page-1", slug: null, isPublished: true } as Partial<Page> as Page);
    const user = userEvent.setup();
    renderToolbar("editor");

    await user.click(screen.getByRole("button", { name: "Publikasikan" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Publikasikan" }));

    await vi.waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    const [, options] = mockToastSuccess.mock.calls[0] as [string, { action?: unknown } | undefined];
    expect(options?.action).toBeUndefined();
  });
});

describe("PageEditorToolbar view published page link", () => {
  const publishedPage: Page = { ...draftPage, isPublished: true, slug: "getting-started" };

  it("links to the platform-domain public URL for a published page", () => {
    render(<PageEditorToolbar page={publishedPage} space={space} title={publishedPage.title} saveStatus="idle" role="editor" />);
    const link = screen.getByRole("link", { name: "Lihat halaman publik" });
    expect(link).toHaveAttribute("href", "/public/test-org/pages/getting-started");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("hides the link for a draft (unpublished) page", () => {
    renderToolbar("editor");
    expect(screen.queryByRole("link", { name: "Lihat halaman publik" })).not.toBeInTheDocument();
  });

  it("shows the link to a viewer too, since it is a non-privileged read-only link", () => {
    render(<PageEditorToolbar page={publishedPage} space={space} title={publishedPage.title} saveStatus="idle" role="viewer" />);
    expect(screen.getByRole("link", { name: "Lihat halaman publik" })).toBeInTheDocument();
  });
});

describe("PageEditorToolbar role gating (US17.2)", () => {
  it("shows the Publish button for an editor", () => {
    renderToolbar("editor");
    expect(screen.getByRole("button", { name: "Publikasikan" })).toBeInTheDocument();
  });

  it("shows the Publish button for an admin", () => {
    renderToolbar("admin");
    expect(screen.getByRole("button", { name: "Publikasikan" })).toBeInTheDocument();
  });

  it("hides the Publish button for a viewer", () => {
    renderToolbar("viewer");
    expect(screen.queryByRole("button", { name: "Publikasikan" })).not.toBeInTheDocument();
  });

  it("hides the Publish button when the user has no permission row at all", () => {
    renderToolbar(null);
    expect(screen.queryByRole("button", { name: "Publikasikan" })).not.toBeInTheDocument();
  });

  it("hides the overflow menu's Unpublish action for a viewer even on a published page", () => {
    render(
      <PageEditorToolbar
        page={{ ...draftPage, isPublished: true }}
        space={space}
        title={draftPage.title}
        saveStatus="idle"
        role="viewer"
      />,
    );
    // Update button (shown for editors/admins on published pages) must not render for a viewer.
    expect(screen.queryByRole("button", { name: "Perbarui" })).not.toBeInTheDocument();
  });
});

describe("PageEditorToolbar topbar layout (wireframe v2 §3.3)", () => {
  it("renders Space / parent / title as a Breadcrumb nav with the current page marked", () => {
    const parent: Page = { ...draftPage, id: "page-0", title: "Onboarding" };
    render(
      <PageEditorToolbar page={draftPage} space={space} title="Daftar & Masuk" saveStatus="idle" role="editor" parentPage={parent} />,
    );
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Test Space" })).toHaveAttribute("href", "/spaces/space-1");
    expect(within(nav).getByRole("link", { name: "Onboarding" })).toHaveAttribute("href", "/spaces/space-1/pages/page-0");
    expect(within(nav).getByText("Daftar & Masuk")).toHaveAttribute("aria-current", "page");
  });

  it("no longer carries the helpfulness badge in the topbar (moved to PageMetaRow)", () => {
    render(<PageEditorToolbar page={{ ...draftPage, isPublished: true }} space={space} title="x" saveStatus="idle" role="admin" />);
    expect(screen.queryByText(/respons/)).not.toBeInTheDocument();
  });

  it("shows the status badge for a draft too", () => {
    renderToolbar("editor");
    expect(screen.getByText("Draf")).toBeInTheDocument();
  });

  it("toggles the side panel from the Komentar, Riwayat and panel buttons, reflecting the open tab", async () => {
    const user = userEvent.setup();
    const onTogglePanelTab = vi.fn();
    const onTogglePanel = vi.fn();
    render(
      <PageEditorToolbar
        page={draftPage}
        space={space}
        title="x"
        saveStatus="idle"
        role="viewer"
        panelTab="comments"
        onTogglePanelTab={onTogglePanelTab}
        onTogglePanel={onTogglePanel}
      />,
    );
    expect(screen.getByRole("button", { name: "Komentar" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Riwayat versi" })).toHaveAttribute("aria-pressed", "false");
    const toggle = screen.getByRole("button", { name: "Panel samping" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-controls", "editor-side-panel");

    await user.click(screen.getByRole("button", { name: "Komentar" }));
    await user.click(screen.getByRole("button", { name: "Riwayat versi" }));
    await user.click(toggle);
    expect(onTogglePanelTab.mock.calls).toEqual([["comments"], ["history"]]);
    expect(onTogglePanel).toHaveBeenCalledTimes(1);
  });

  it("opens version history from the chevron menu's Riwayat Versi item", async () => {
    const user = userEvent.setup();
    const onOpenVersionHistory = vi.fn();
    render(
      <PageEditorToolbar page={draftPage} space={space} title="x" saveStatus="idle" role="editor" onOpenVersionHistory={onOpenVersionHistory} />,
    );
    await user.click(screen.getByRole("button", { name: "Menu lainnya" }));
    await user.click(await screen.findByRole("menuitem", { name: "Riwayat Versi" }));
    expect(onOpenVersionHistory).toHaveBeenCalledTimes(1);
  });

  it("keeps Tab order: breadcrumb, Komentar, Riwayat, panel toggle, Publikasikan, menu", async () => {
    const user = userEvent.setup();
    renderToolbar("editor");
    const expected = ["Test Space", "Komentar", "Riwayat versi", "Panel samping", "Publikasikan", "Menu lainnya"];
    for (const name of expected) {
      await user.tab();
      expect(document.activeElement).toHaveAccessibleName(name);
    }
  });
});

describe("PageEditorToolbar delete page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeletePage.mockResolvedValue(undefined);
  });

  async function openOverflowMenu() {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Menu lainnya" }));
    return user;
  }

  it("shows Hapus Halaman in the overflow menu for an editor", async () => {
    renderToolbar("editor");
    await openOverflowMenu();
    expect(await screen.findByRole("menuitem", { name: /Hapus Halaman/ })).toBeInTheDocument();
  });

  it("hides Hapus Halaman in the overflow menu for a viewer", async () => {
    renderToolbar("viewer");
    await openOverflowMenu();
    await screen.findByRole("menuitem", { name: "Riwayat Versi" });
    expect(screen.queryByRole("menuitem", { name: /Hapus Halaman/ })).not.toBeInTheDocument();
  });

  it("deletes the page and redirects to the Space on confirm", async () => {
    renderToolbar("admin");
    const user = await openOverflowMenu();
    await user.click(await screen.findByRole("menuitem", { name: /Hapus Halaman/ }));
    await user.click(await screen.findByRole("button", { name: "Hapus Halaman" }));

    expect(mockDeletePage).toHaveBeenCalledWith("page-1");
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledWith("/spaces/space-1"));
  });
});

describe("PageEditorToolbar unpublished-changes banner (PRD Flow 4 step 4)", () => {
  it("shows the banner with its own Perbarui button for an editor on a published page with pending changes", () => {
    mockHasUnpublishedChanges.mockReturnValue(true);
    render(<PageEditorToolbar page={{ ...draftPage, isPublished: true }} space={space} title="x" saveStatus="idle" role="editor" />);
    expect(screen.getByText("Anda memiliki perubahan yang belum dipublikasikan.")).toBeInTheDocument();
    expect(screen.getByText("Menunggu")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Perbarui" })).toHaveLength(2);
    mockHasUnpublishedChanges.mockReturnValue(false);
  });

  it("never shows the banner to a viewer", () => {
    mockHasUnpublishedChanges.mockReturnValue(true);
    render(<PageEditorToolbar page={{ ...draftPage, isPublished: true }} space={space} title="x" saveStatus="idle" role="viewer" />);
    expect(screen.queryByText("Anda memiliki perubahan yang belum dipublikasikan.")).not.toBeInTheDocument();
    mockHasUnpublishedChanges.mockReturnValue(false);
  });
});
