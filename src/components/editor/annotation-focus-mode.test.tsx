import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSyncExternalStore } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnnotationFocusMode } from "./annotation-focus-mode";
import { PageIdProvider } from "./page-id-context";
import { createStore } from "@/lib/store";
import type { Annotation, ScreenshotBlock } from "@/lib/types";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

let mockFocusedBlockId: string | null = null;
const mockCloseAnnotationFocus = vi.fn(() => {
  mockFocusedBlockId = null;
});
vi.mock("@/lib/annotation-focus-store", () => ({
  useAnnotationFocusBlockId: () => mockFocusedBlockId,
  closeAnnotationFocus: () => mockCloseAnnotationFocus(),
}));

let mockTool: string | null = null;
const mockSetActiveAnnotationTool = vi.fn((_blockId: string, tool: string | null) => {
  mockTool = tool;
});
vi.mock("@/lib/annotation-tool-store", () => ({
  useActiveAnnotationTool: () => [mockTool, (tool: string | null) => mockSetActiveAnnotationTool("shot-1", tool)],
  setActiveAnnotationTool: (blockId: string, tool: string | null) => mockSetActiveAnnotationTool(blockId, tool),
}));

// A real reactive store (not just a static return value) — annotations
// placed through the overlay must actually round-trip back through props
// the same way the real screenshotBlocksStore does, or undo/redo (which
// reads "the current annotations" at the moment each action runs) can't be
// exercised honestly.
const mockBlockStore = createStore<ScreenshotBlock | undefined>(undefined);
const mockUpdateAnnotationsSpy = vi.fn();
const mockPatchAnnotationsLocalSpy = vi.fn();
const mockUpdateDescription = vi.fn(() => Promise.resolve());

function mockUpdateAnnotations(id: string, annotations: Annotation[]) {
  mockUpdateAnnotationsSpy(id, annotations);
  mockBlockStore.setState((prev) => (prev ? { ...prev, annotations } : prev));
  return Promise.resolve();
}
function mockPatchAnnotationsLocal(id: string, annotations: Annotation[]) {
  mockPatchAnnotationsLocalSpy(id, annotations);
  mockBlockStore.setState((prev) => (prev ? { ...prev, annotations } : prev));
}

vi.mock("@/hooks/use-screenshot-blocks", () => ({
  useScreenshotBlock: () => useSyncExternalStore(mockBlockStore.subscribe, mockBlockStore.getState, mockBlockStore.getState),
  useUpdateScreenshotAnnotations: () => mockUpdateAnnotations,
  usePatchScreenshotAnnotationsLocal: () => mockPatchAnnotationsLocal,
  useUpdateScreenshotDescription: () => mockUpdateDescription,
}));

const baseBlock: ScreenshotBlock = {
  id: "shot-1",
  pageId: "page-1",
  type: "screenshot",
  order: 0,
  imageUrl: "shot.png",
  imageWidth: 800,
  imageHeight: 600,
  annotations: [],
  description: "",
  altText: "",
  createdAt: "t",
  updatedAt: "t",
};

function renderFocusMode() {
  return render(
    <PageIdProvider pageId="page-1">
      <AnnotationFocusMode />
    </PageIdProvider>,
  );
}

describe("AnnotationFocusMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFocusedBlockId = null;
    mockTool = null;
    mockBlockStore.setState({ ...baseBlock });
    Object.defineProperty(SVGSVGElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
    });
  });

  it("renders nothing when no block is focused", () => {
    render(
      <PageIdProvider pageId="page-1">
        <AnnotationFocusMode />
      </PageIdProvider>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the full-screen dialog with the tool rail when a block is focused", async () => {
    mockFocusedBlockId = "shot-1";
    renderFocusMode();

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nomor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Panah" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kotak" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Label" })).toBeInTheDocument();
  });

  it("selecting a tool from the rail drives the shared active-tool store", async () => {
    mockFocusedBlockId = "shot-1";
    const user = userEvent.setup();
    renderFocusMode();

    await user.click(await screen.findByRole("button", { name: "Kotak" }));
    expect(mockSetActiveAnnotationTool).toHaveBeenCalledWith("shot-1", "box");
  });

  it("placing a shape patches the store immediately, then debounce-saves after 500ms", async () => {
    mockFocusedBlockId = "shot-1";
    mockTool = "marker";
    renderFocusMode();
    // Fake timers must come after the initial render/query — RTL's find*
    // queries poll with real setTimeout under the hood, which never
    // resolves once fake timers are active.
    const canvas = await screen.findByTestId("annotation-editor-canvas");
    vi.useFakeTimers();
    fireEvent.pointerDown(canvas, { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 80, clientY: 60, pointerId: 1 });

    expect(mockPatchAnnotationsLocalSpy).toHaveBeenCalledWith("shot-1", [expect.objectContaining({ type: "marker" })]);
    expect(mockUpdateAnnotationsSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(mockUpdateAnnotationsSpy).toHaveBeenCalledWith("shot-1", [expect.objectContaining({ type: "marker" })]);

    vi.useRealTimers();
  });

  it("lists placed objects in the right panel and deletes one via its own trash icon", async () => {
    const marker: Annotation = { id: "a1", type: "marker", order: 1, color: "#fff", x: 0.1, y: 0.1 };
    mockBlockStore.setState({ ...baseBlock, annotations: [marker] });
    mockFocusedBlockId = "shot-1";
    const user = userEvent.setup();
    renderFocusMode();

    expect(await screen.findByText("Nomor 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hapus Nomor 1" }));

    expect(mockPatchAnnotationsLocalSpy).toHaveBeenCalledWith("shot-1", []);
  });

  it("undo reverts the last change and redo re-applies it", async () => {
    mockFocusedBlockId = "shot-1";
    mockTool = "marker";
    renderFocusMode();

    const canvas = await screen.findByTestId("annotation-editor-canvas");
    fireEvent.pointerDown(canvas, { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 80, clientY: 60, pointerId: 1 });
    await waitFor(() => expect(mockPatchAnnotationsLocalSpy).toHaveBeenCalledWith("shot-1", [expect.objectContaining({ type: "marker" })]));
    mockPatchAnnotationsLocalSpy.mockClear();

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(mockPatchAnnotationsLocalSpy).toHaveBeenCalledWith("shot-1", []);

    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(mockPatchAnnotationsLocalSpy).toHaveBeenCalledWith("shot-1", [expect.objectContaining({ type: "marker" })]);
  });

  it("edits the step description through the same update hook the inline block uses", async () => {
    mockFocusedBlockId = "shot-1";
    const user = userEvent.setup();
    renderFocusMode();

    const textarea = await screen.findByLabelText("Deskripsi langkah");
    await user.type(textarea, "Klik tombol simpan");

    expect(textarea).toHaveValue("Klik tombol simpan");
  });

  it("Selesai closes the dialog and clears the active tool without reverting changes", async () => {
    mockFocusedBlockId = "shot-1";
    mockTool = "box";
    const user = userEvent.setup();
    renderFocusMode();

    await user.click(await screen.findByRole("button", { name: "Selesai" }));

    expect(mockCloseAnnotationFocus).toHaveBeenCalled();
    expect(mockSetActiveAnnotationTool).toHaveBeenCalledWith("shot-1", null);
    expect(mockUpdateAnnotationsSpy).not.toHaveBeenCalled();
  });

  it("Batal reverts to the annotations the block had when the session opened, then closes", async () => {
    const original: Annotation[] = [{ id: "orig", type: "marker", order: 1, color: "#fff", x: 0.1, y: 0.1 }];
    mockBlockStore.setState({ ...baseBlock, annotations: original });
    mockFocusedBlockId = "shot-1";
    mockTool = "box";
    const user = userEvent.setup();
    renderFocusMode();

    // Draw a box, mutating past the opened-at snapshot.
    const canvas = await screen.findByTestId("annotation-editor-canvas");
    fireEvent.pointerDown(canvas, { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 240, clientY: 180, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 240, clientY: 180, pointerId: 1 });
    mockPatchAnnotationsLocalSpy.mockClear();

    await user.click(screen.getByRole("button", { name: "Batal" }));

    expect(mockPatchAnnotationsLocalSpy).toHaveBeenCalledWith("shot-1", original);
    expect(mockCloseAnnotationFocus).toHaveBeenCalled();
  });

  it("closes when Esc is pressed", async () => {
    mockFocusedBlockId = "shot-1";
    renderFocusMode();
    await screen.findByRole("dialog");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(mockCloseAnnotationFocus).toHaveBeenCalled());
  });
});
