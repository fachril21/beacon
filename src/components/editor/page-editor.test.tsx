import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, act, fireEvent, screen, waitFor } from "@testing-library/react";
import { setVersionPreview } from "@/lib/version-preview-store";
import { PageEditor } from "./page-editor";
import { emptyDoc } from "@/lib/mock/blocknote-content";
import type { Page } from "@/lib/types";

vi.mock("@/hooks/use-page-autosave", () => ({
  usePageAutosave: () => ({ status: "idle", scheduleSave: vi.fn(), cancelScheduledSave: vi.fn() }),
}));

vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/hooks/use-comments", () => ({ usePageComments: () => [], useBlockComments: () => [] }));
vi.mock("@/hooks/use-versions", () => ({
  useVersionSnapshots: () => vi.fn(),
}));

const { mockUploadScreenshot } = vi.hoisted(() => ({ mockUploadScreenshot: vi.fn() }));
vi.mock("@/hooks/use-screenshot-blocks", () => ({
  useUploadScreenshot: () => mockUploadScreenshot,
  useScreenshotBlock: () => undefined,
  useUpdateScreenshotDescription: () => vi.fn(),
}));

vi.mock("@/lib/image-dimensions", () => ({
  readImageDimensions: vi.fn(async () => ({ width: 640, height: 480 })),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

const previewed = {
  id: "v-1",
  pageId: "page-1",
  title: "Lama",
  content: [],
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  isRestoreOf: null,
};

const page: Page = {
  id: "page-1",
  spaceId: "space-1",
  parentPageId: null,
  title: "Untitled",
  order: 0,
  content: emptyDoc(),
  visibility: "internal",
  slug: null,
  isPublished: false,
  publishedContentSnapshot: null,
  publishedAt: null,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  mockUploadScreenshot.mockReset();
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
});

function pasteImage(editableRoot: Element, file: File) {
  const clipboardData = {
    items: [{ kind: "file", type: file.type, getAsFile: () => file }],
    files: [file],
    types: [],
    getData: () => "",
  } as unknown as DataTransfer;
  const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(pasteEvent, "clipboardData", { value: clipboardData });
  fireEvent(editableRoot, pasteEvent);
}

describe("PageEditor paste image", () => {
  it("uploads a pasted image and inserts a screenshot block at the cursor", async () => {
    mockUploadScreenshot.mockResolvedValue({ id: "shot-new" });
    const file = new File(["image-bytes"], "paste.png", { type: "image/png" });
    const { container } = render(<PageEditor page={page} editable={true} />);
    const editableRoot = container.querySelector(".bn-editor");
    expect(editableRoot).not.toBeNull();

    pasteImage(editableRoot as Element, file);

    await waitFor(() =>
      expect(mockUploadScreenshot).toHaveBeenCalledWith(
        expect.objectContaining({ pageId: "page-1", file, width: 640, height: 480 }),
      ),
    );
    await waitFor(() => expect(screen.getByText(/Seret gambar ke sini/)).toBeInTheDocument());
  });

  it("does not upload an image pasted while the editor is read-only", () => {
    const file = new File(["image-bytes"], "paste.png", { type: "image/png" });
    const { container } = render(<PageEditor page={page} editable={false} />);
    const editableRoot = container.querySelector(".bn-editor");
    expect(editableRoot).not.toBeNull();

    pasteImage(editableRoot as Element, file);

    expect(mockUploadScreenshot).not.toHaveBeenCalled();
  });
});

describe("PageEditor editable prop", () => {
  it("reflects the `editable` prop on the underlying contentEditable root, including after a late-arriving role (US17.2)", () => {
    // Mirrors PageEditorPage: role starts null (permissions still loading) -> editable=false
    // on first mount, then flips true once useSpaceRole resolves a moment later.
    const { container, rerender } = render(<PageEditor page={page} editable={false} />);
    const editableRoot = container.querySelector(".bn-editor");
    expect(editableRoot).toHaveAttribute("contenteditable", "false");

    rerender(<PageEditor page={page} editable={true} />);
    expect(editableRoot).toHaveAttribute("contenteditable", "true");
  });

  it("is locked read-only while a version preview is open, even for an editor, and unlocks after", () => {
    const { container } = render(<PageEditor page={page} editable={true} />);
    const editableRoot = container.querySelector(".bn-editor");
    expect(editableRoot).toHaveAttribute("contenteditable", "true");

    act(() => setVersionPreview(page.id, previewed));
    expect(editableRoot).toHaveAttribute("contenteditable", "false");

    act(() => setVersionPreview(page.id, null));
    expect(editableRoot).toHaveAttribute("contenteditable", "true");
  });
});
