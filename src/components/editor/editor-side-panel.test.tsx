import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorSidePanel } from "./editor-side-panel";
import type { EditorSidePanelTab } from "./editor-side-panel-tab";
import type { Comment, Page, PageContent, Version } from "@/lib/types";

class IntersectionObserverStub {
  observe() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);

const mockComments: Comment[] = [];
vi.mock("@/hooks/use-comments", () => ({
  usePageComments: () => mockComments,
}));

vi.mock("@/hooks/use-users", () => ({
  useUser: (id: string) => ({ id, name: id === "user-2" ? "Sari" : "Fachril" }),
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ user: { id: "user-1" } }),
}));

const mockRestoreVersion = vi.fn();
const versions: Version[] = [
  {
    id: "v-1",
    pageId: "page-1",
    title: "Versi lama",
    content: [],
    createdByUserId: "user-1",
    createdAt: "2026-01-02T00:00:00.000Z",
    isRestoreOf: null,
  } as Version,
];
vi.mock("@/hooks/use-versions", () => ({
  usePageVersions: () => versions,
  useRestoreVersion: () => mockRestoreVersion,
}));

const content = [
  { id: "h-1", type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Mengisi formulir", styles: {} }] },
  { id: "bn-shot", type: "screenshot", props: { screenshotBlockId: "shot-1" } },
] as unknown as PageContent;

const page: Page = {
  id: "page-1",
  spaceId: "space-1",
  parentPageId: null,
  title: "Daftar",
  order: 0,
  content,
  visibility: "internal",
  slug: null,
  isPublished: false,
  publishedContentSnapshot: null,
  publishedAt: null,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderPanel(tab: EditorSidePanelTab, overrides: { onTabChange?: () => void; onClose?: () => void } = {}) {
  const onTabChange = overrides.onTabChange ?? vi.fn();
  const onClose = overrides.onClose ?? vi.fn();
  render(<EditorSidePanel page={page} tab={tab} onTabChange={onTabChange} onClose={onClose} scrollRootRef={createRef()} />);
  return { onTabChange, onClose };
}

describe("EditorSidePanel", () => {
  beforeEach(() => {
    mockComments.length = 0;
    mockRestoreVersion.mockClear();
  });

  it("renders the three tabs with the page's comment count", () => {
    mockComments.push({
      id: "c-1",
      pageId: "page-1",
      blockId: "shot-1",
      authorUserId: "user-2",
      body: "Tolong perjelas",
      mentionedUserIds: [],
      createdAt: "2026-01-03T00:00:00.000Z",
    });
    renderPanel("toc");
    expect(screen.getByRole("tab", { name: "Daftar isi" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Komentar 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Riwayat" })).toBeInTheDocument();
  });

  it("Daftar isi lists the page's headings", () => {
    renderPanel("toc");
    const toc = screen.getByRole("navigation", { name: "Daftar isi" });
    expect(within(toc).getByRole("button", { name: "Mengisi formulir" })).toBeInTheDocument();
  });

  it("Komentar lists page comments and links a screenshot comment back to its block", () => {
    mockComments.push({
      id: "c-1",
      pageId: "page-1",
      blockId: "shot-1",
      authorUserId: "user-2",
      body: "Tolong perjelas",
      mentionedUserIds: [],
      createdAt: "2026-01-03T00:00:00.000Z",
    });
    renderPanel("comments");
    expect(screen.getByText("Sari")).toBeInTheDocument();
    expect(screen.getByText("Tolong perjelas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lihat blok" })).toBeInTheDocument();
  });

  it("Komentar shows an empty state when there are none", () => {
    renderPanel("comments");
    expect(screen.getByText(/Belum ada komentar/)).toBeInTheDocument();
  });

  it("reports tab switches to the owner", async () => {
    const user = userEvent.setup();
    const { onTabChange } = renderPanel("toc");
    await user.click(screen.getByRole("tab", { name: "Riwayat" }));
    expect(onTabChange).toHaveBeenCalledWith("history");
  });

  it("Riwayat keeps preview + restore semantics, closing the panel after a restore", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel("history");
    await user.click(screen.getByRole("button", { name: /Fachril/ }));
    expect(screen.getByText("Pratinjau versi — bukan draf yang sedang aktif")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pulihkan versi ini" }));
    expect(mockRestoreVersion).toHaveBeenCalledWith("page-1", "v-1", "user-1");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the X button and from Esc inside the panel", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel("toc");
    await user.click(screen.getByRole("button", { name: "Tutup panel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    screen.getByRole("tab", { name: "Daftar isi" }).focus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
