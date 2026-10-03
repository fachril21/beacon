import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditorSidePanel } from "./editor-side-panel";
import { renderHook } from "@testing-library/react";
import { useVersionPreview } from "@/lib/version-preview-store";
import { focusBlockComments, clearBlockCommentFocus } from "@/lib/comment-focus-store";
import { useCommentReadMarks, lastReadAt, clearCommentReadMarks } from "@/lib/comment-read-store";
import type { EditorSidePanelTab } from "./editor-side-panel-tab";
import type { Comment, Page, PageContent, Version } from "@/lib/types";

class IntersectionObserverStub {
  observe() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);

const mockComments: Comment[] = [];
const mockCreateComment = vi.fn();
vi.mock("@/hooks/use-comments", () => ({
  usePageComments: () => mockComments,
  useCreateComment: () => mockCreateComment,
}));

vi.mock("@/hooks/use-mention-candidates", () => ({
  useMentionCandidates: () => [{ id: "user-2", name: "Sari", email: "s@x.id", avatarUrl: null, organizationId: null, createdAt: "t" }],
}));

const mockUsers = [
  { id: "user-1", name: "Fachril" },
  { id: "user-2", name: "Sari" },
];
vi.mock("@/hooks/use-users", () => ({
  useUser: (id: string) => mockUsers.find((u) => u.id === id) ?? { id, name: "Fachril" },
  useUsers: () => mockUsers,
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ user: { id: "user-1" } }),
}));

const mockToastError = vi.fn();
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: (...args: unknown[]) => mockToastError(...args) }) }));

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

function renderPanel(
  tab: EditorSidePanelTab,
  overrides: { onTabChange?: () => void; onClose?: () => void; canRestore?: boolean } = {},
) {
  const onTabChange = overrides.onTabChange ?? vi.fn();
  const onClose = overrides.onClose ?? vi.fn();
  render(
    <EditorSidePanel
      page={page}
      tab={tab}
      onTabChange={onTabChange}
      onClose={onClose}
      scrollRootRef={createRef()}
      canRestore={overrides.canRestore ?? true}
    />,
  );
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

  it("Komentar highlights @mentions of people named in the comment", () => {
    mockComments.push({
      id: "c-1",
      pageId: "page-1",
      blockId: "shot-1",
      authorUserId: "user-1",
      body: "Tolong cek @Sari ya",
      mentionedUserIds: ["user-2"],
      createdAt: "2026-01-03T00:00:00.000Z",
    });
    renderPanel("comments");
    expect(screen.getByText("@Sari")).toHaveAttribute("data-mention", "true");
  });

  it("Komentar marks the comments it shows as read for the current user, so their block cue goes away", () => {
    window.localStorage.clear();
    clearCommentReadMarks();
    const marks = renderHook(() => useCommentReadMarks());
    mockComments.push(
      { id: "c-1", pageId: "page-1", blockId: "shot-1", authorUserId: "user-2", body: "a", mentionedUserIds: [], createdAt: "2026-01-03T00:00:00.000Z" },
      { id: "c-2", pageId: "page-1", blockId: "shot-1", authorUserId: "user-2", body: "b", mentionedUserIds: [], createdAt: "2026-01-05T00:00:00.000Z" },
    );
    renderPanel("comments");
    expect(lastReadAt(marks.result.current, "user-1", "page-1", "shot-1")).toBe("2026-01-05T00:00:00.000Z");
  });

  it("Komentar has a composer that posts a page-level comment", async () => {
    mockCreateComment.mockResolvedValue({ id: "c-new" });
    const user = userEvent.setup();
    renderPanel("comments");
    await user.type(screen.getByRole("textbox"), "Catatan umum");
    await user.click(screen.getByRole("button", { name: "Kirim" }));
    expect(mockCreateComment).toHaveBeenCalledWith("page-1", "page", "user-1", "Catatan umum", []);
  });

  it("Komentar narrows to one block when the editor side menu asks for it, and the composer targets that block", async () => {
    mockComments.push(
      { id: "c-1", pageId: "page-1", blockId: "h-1", authorUserId: "user-1", body: "Untuk heading", mentionedUserIds: [], createdAt: "2026-01-03T00:00:00.000Z" },
      { id: "c-2", pageId: "page-1", blockId: "other", authorUserId: "user-1", body: "Untuk blok lain", mentionedUserIds: [], createdAt: "2026-01-04T00:00:00.000Z" },
    );
    mockCreateComment.mockResolvedValue({ id: "c-new" });
    const user = userEvent.setup();
    renderPanel("comments");
    act(() => focusBlockComments("page-1", "h-1"));

    expect(screen.getByText("Untuk heading")).toBeInTheDocument();
    expect(screen.queryByText("Untuk blok lain")).not.toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "Balasan");
    await user.click(screen.getByRole("button", { name: "Kirim" }));
    expect(mockCreateComment).toHaveBeenCalledWith("page-1", "h-1", "user-1", "Balasan", []);

    await user.click(screen.getByRole("button", { name: "Lihat semua komentar" }));
    expect(screen.getByText("Untuk blok lain")).toBeInTheDocument();
    act(() => clearBlockCommentFocus("page-1"));
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

  it("Riwayat previews a version, asks for confirmation, restores, then closes the panel", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel("history");
    await user.click(screen.getByRole("button", { name: /Fachril/ }));

    await user.click(screen.getByRole("button", { name: "Pulihkan versi ini" }));
    expect(mockRestoreVersion).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Pulihkan" }));

    await vi.waitFor(() => expect(mockRestoreVersion).toHaveBeenCalledWith("page-1", "v-1", "user-1"));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("Riwayat cancelling the confirmation restores nothing", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel("history");
    await user.click(screen.getByRole("button", { name: /Fachril/ }));
    await user.click(screen.getByRole("button", { name: "Pulihkan versi ini" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Batal" }));

    expect(mockRestoreVersion).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Riwayat keeps the panel open and shows an error toast when the restore fails", async () => {
    mockToastError.mockClear();
    mockRestoreVersion.mockRejectedValueOnce({ code: "42501", message: "denied" });
    const user = userEvent.setup();
    const { onClose } = renderPanel("history");
    await user.click(screen.getByRole("button", { name: /Fachril/ }));
    await user.click(screen.getByRole("button", { name: "Pulihkan versi ini" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Pulihkan" }));

    await vi.waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Riwayat hides the restore action for a user who cannot edit, but still allows previewing", async () => {
    const user = userEvent.setup();
    renderPanel("history", { canRestore: false });
    await user.click(screen.getByRole("button", { name: /Fachril/ }));
    expect(screen.getByRole("button", { name: "Kembali" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pulihkan versi ini" })).not.toBeInTheDocument();
  });

  it("Riwayat shows the selected version in the editor (preview store), not in the panel, and clears on Kembali", async () => {
    const user = userEvent.setup();
    const preview = renderHook(() => useVersionPreview("page-1"));
    renderPanel("history");
    expect(preview.result.current).toBeNull();

    await user.click(screen.getByRole("button", { name: /Fachril/ }));
    expect(preview.result.current).toMatchObject({ id: "v-1" });
    // The panel no longer renders the version body itself.
    expect(screen.queryByText("Pratinjau versi — bukan draf yang sedang aktif")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Kembali" }));
    expect(preview.result.current).toBeNull();
  });

  it("Riwayat keeps the version list visible and marks the selected one while previewing", async () => {
    const user = userEvent.setup();
    renderPanel("history");
    const entry = screen.getByRole("button", { name: /Fachril/ });
    await user.click(entry);
    expect(screen.getByRole("button", { name: /Fachril/ })).toHaveAttribute("aria-current", "true");
  });

  it("Riwayat releases the preview when the panel goes away mid-preview", async () => {
    const user = userEvent.setup();
    const preview = renderHook(() => useVersionPreview("page-1"));
    const { unmount } = render(
      <EditorSidePanel page={page} tab="history" onTabChange={vi.fn()} onClose={vi.fn()} scrollRootRef={createRef()} canRestore />,
    );
    await user.click(screen.getByRole("button", { name: /Fachril/ }));
    expect(preview.result.current).not.toBeNull();

    unmount();
    expect(preview.result.current).toBeNull();
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
