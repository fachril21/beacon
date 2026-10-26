import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense } from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PageEditorPage from "./page";
import type { EditorSidePanelTab } from "@/components/editor/editor-side-panel-tab";
import type { Page, Space } from "@/lib/types";

const paramsPromise = Promise.resolve({ spaceId: "space-1", pageId: "page-1" });

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: { id: "user-1" } }) }));

const space: Space = {
  id: "space-1",
  organizationId: "org-1",
  name: "Aplikasi Mobile",
  slug: "aplikasi-mobile",
  category: null,
  isPublishable: true,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};
let mockRole: "viewer" | "editor" | "admin" | null = "editor";
vi.mock("@/hooks/use-spaces", () => ({
  useSpace: () => space,
  useSpaceRole: () => mockRole,
}));

const page: Page = {
  id: "page-1",
  spaceId: "space-1",
  parentPageId: "page-0",
  title: "Daftar & Masuk",
  order: 0,
  content: [],
  visibility: "internal",
  slug: null,
  isPublished: false,
  publishedContentSnapshot: null,
  description: "",
  emoji: null,
  publishedAt: null,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const parentPage: Page = { ...page, id: "page-0", parentPageId: null, title: "Onboarding" };
const mockUpdateMeta = vi.fn();
vi.mock("@/hooks/use-pages", () => ({
  usePage: (id: string | undefined) => (id === "page-1" ? page : id === "page-0" ? parentPage : undefined),
  useUpdatePageMeta: () => mockUpdateMeta,
}));

vi.mock("@/hooks/use-title-autosave", () => ({
  useTitleAutosave: (_pageId: string, title: string | undefined) => ({ title: title ?? "", scheduleTitleSave: vi.fn(), flushTitleSave: vi.fn() }),
}));

vi.mock("@/components/editor/page-editor", () => ({ PageEditor: () => <div data-testid="page-editor" /> }));
vi.mock("@/components/editor/page-meta-row", () => ({
  PageMetaRow: ({ canEdit }: { canEdit: boolean }) => <div data-testid="page-meta-row" data-can-edit={String(canEdit)} />,
}));

// Stand-ins that expose exactly the wiring under test: which tab the panel
// is on, and the toolbar callbacks that drive it.
vi.mock("@/components/editor/page-editor-toolbar", () => ({
  PageEditorToolbar: (props: {
    parentPage?: Page | null;
    panelTab: EditorSidePanelTab | null;
    onTogglePanelTab: (tab: EditorSidePanelTab) => void;
    onTogglePanel: () => void;
    onOpenVersionHistory: () => void;
  }) => (
    <div>
      <span data-testid="toolbar-parent">{props.parentPage?.title ?? ""}</span>
      <span data-testid="toolbar-panel-tab">{props.panelTab ?? "closed"}</span>
      <button id="editor-panel-toggle" onClick={props.onTogglePanel}>
        toggle
      </button>
      <button onClick={() => props.onTogglePanelTab("comments")}>comments</button>
      <button onClick={props.onOpenVersionHistory}>riwayat versi</button>
    </div>
  ),
}));
vi.mock("@/components/editor/editor-side-panel", () => ({
  EditorSidePanel: (props: { tab: EditorSidePanelTab; onClose: () => void }) => (
    <aside data-testid="side-panel" data-tab={props.tab}>
      <button onClick={props.onClose}>close panel</button>
    </aside>
  ),
}));

function stubViewport(width: number) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(min-width: 1440px)" && width >= 1440,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

async function renderPage() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <PageEditorPage params={paramsPromise} />
      </Suspense>,
    );
  });
}

describe("PageEditorPage side panel", () => {
  beforeEach(() => {
    mockRole = "editor";
  });

  it("opens the panel on Daftar isi by default at ≥1440px", async () => {
    stubViewport(1440);
    await renderPage();
    expect(screen.getByTestId("side-panel")).toHaveAttribute("data-tab", "toc");
    expect(screen.getByTestId("toolbar-panel-tab")).toHaveTextContent("toc");
  });

  it("keeps the panel closed by default below 1440px", async () => {
    stubViewport(1280);
    await renderPage();
    expect(screen.queryByTestId("side-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("toolbar-panel-tab")).toHaveTextContent("closed");
  });

  it("opens on the Riwayat tab from the Riwayat Versi menu item", async () => {
    stubViewport(1280);
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole("button", { name: "riwayat versi" }));
    expect(screen.getByTestId("side-panel")).toHaveAttribute("data-tab", "history");
  });

  it("toggles a tab closed when its icon is pressed twice, and reopens on the last tab from the panel toggle", async () => {
    stubViewport(1280);
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole("button", { name: "comments" }));
    expect(screen.getByTestId("side-panel")).toHaveAttribute("data-tab", "comments");
    await user.click(screen.getByRole("button", { name: "comments" }));
    expect(screen.queryByTestId("side-panel")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("side-panel")).toHaveAttribute("data-tab", "comments");
  });

  it("closing the panel hands focus back to the topbar toggle", async () => {
    stubViewport(1440);
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole("button", { name: "close panel" }));
    expect(screen.queryByTestId("side-panel")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "toggle" }));
  });
});

describe("PageEditorPage writing column", () => {
  // The viewer test below flips this and never resets it — pin it so each
  // case starts from an editable Space role.
  beforeEach(() => {
    mockRole = "editor";
  });

  it("passes the parent Page to the breadcrumb and renders the meta row instead of the old footer", async () => {
    stubViewport(1280);
    await renderPage();
    expect(screen.getByTestId("toolbar-parent")).toHaveTextContent("Onboarding");
    expect(screen.getByTestId("page-meta-row")).toHaveAttribute("data-can-edit", "true");
    expect(screen.queryByText(/Dibuat oleh/)).not.toBeInTheDocument();
  });

  it("makes the title read-only for a viewer", async () => {
    stubViewport(1280);
    mockRole = "viewer";
    await renderPage();
    expect(screen.getByDisplayValue("Daftar & Masuk")).toHaveAttribute("readonly");
  });

  it("shows the Untitled page placeholder on a required title and the optional description field", async () => {
    stubViewport(1280);
    await renderPage();

    const titleInput = screen.getByPlaceholderText("Untitled page");
    expect(titleInput).toBeRequired();
    expect(titleInput).toHaveAttribute("aria-required", "true");

    const descriptionInput = screen.getByPlaceholderText("Page Description (Optional)");
    expect(descriptionInput).toBeInTheDocument();
    expect(descriptionInput).not.toBeRequired();
  });

  it("offers the emoji control beside the title but renders no emoji until one is chosen", async () => {
    stubViewport(1280);
    await renderPage();

    const trigger = screen.getByRole("button", { name: "Tambahkan emoji halaman" });
    expect(trigger.textContent).toBe("");
    expect(trigger.querySelector("svg")).not.toBeNull();
  });

  it("keeps the emoji outside the title/description column so it never indents the title", async () => {
    stubViewport(1280);
    await renderPage();

    const trigger = screen.getByRole("button", { name: "Tambahkan emoji halaman" });
    const title = screen.getByPlaceholderText("Untitled page");
    const description = screen.getByPlaceholderText("Page Description (Optional)");

    // Title and description share one text column — the single left edge that
    // the body content below (and the emoji-free layout) also uses.
    const textColumn = title.parentElement as HTMLElement;
    expect(textColumn.contains(description)).toBe(true);

    // The emoji is a sibling of that column, not part of it, so it cannot
    // push the title sideways regardless of its size.
    expect(textColumn.contains(trigger)).toBe(false);
    expect(trigger.parentElement).toBe(textColumn.parentElement);

    // On md+ it is taken out of flow into the editor's left gutter.
    expect(trigger.className).toContain("md:absolute");
    expect(trigger.className).toContain("md:mb-0");
  });

  it("saves the emoji picked beside the title", async () => {
    stubViewport(1280);
    mockUpdateMeta.mockClear();
    const user = userEvent.setup();
    await renderPage();

    await user.click(screen.getByRole("button", { name: "Tambahkan emoji halaman" }));
    await user.click(await screen.findByRole("button", { name: "Pilih emoji 📘" }));

    await vi.waitFor(() => expect(mockUpdateMeta).toHaveBeenCalledWith("page-1", { emoji: "📘" }));
  });
});
