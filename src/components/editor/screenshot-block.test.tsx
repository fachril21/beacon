import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { editorSchema } from "./schema";
import { PageIdProvider } from "./page-id-context";
import type { ScreenshotBlock } from "@/lib/types";

vi.mock("./comment-thread-panel", () => ({ CommentThreadPanel: () => null }));

const mockUseScreenshotBlock = vi.fn();
const mockUpdateAnnotations = vi.fn();
const mockPatchAnnotationsLocal = vi.fn();
vi.mock("@/hooks/use-screenshot-blocks", () => ({
  useScreenshotBlock: (id?: string) => mockUseScreenshotBlock(id),
  useUploadScreenshot: () => vi.fn(),
  useUpdateScreenshotDescription: () => vi.fn(),
  useUpdateScreenshotAnnotations: () => mockUpdateAnnotations,
  usePatchScreenshotAnnotationsLocal: () => mockPatchAnnotationsLocal,
}));

const mockBlock: ScreenshotBlock = {
  id: "shot-1",
  pageId: "page-1",
  type: "screenshot",
  order: 0,
  imageUrl: "shot.png",
  imageWidth: 400,
  imageHeight: 300,
  annotations: [],
  description: "",
  altText: "Contoh tangkapan layar",
  createdAt: "t",
  updatedAt: "t",
};

function TestEditor({ editable, screenshotBlockId }: { editable: boolean; screenshotBlockId: string }) {
  const editor = useCreateBlockNote({
    schema: editorSchema,
    initialContent: [{ type: "screenshot", props: { screenshotBlockId } }],
  });
  return (
    <PageIdProvider pageId="page-1">
      <BlockNoteView editor={editor} editable={editable} formattingToolbar={false} slashMenu={false} linkToolbar={false} sideMenu={false} />
    </PageIdProvider>
  );
}

describe("screenshot block render", () => {
  it("shows the upload prompt when editable and no screenshot block is attached yet", () => {
    mockUseScreenshotBlock.mockReturnValue(undefined);
    render(<TestEditor editable={true} screenshotBlockId="" />);
    expect(screen.getByText(/Seret gambar ke sini/)).toBeInTheDocument();
  });

  it("never shows the upload prompt to a read-only Viewer, even for an empty block", () => {
    mockUseScreenshotBlock.mockReturnValue(undefined);
    render(<TestEditor editable={false} screenshotBlockId="" />);
    expect(screen.queryByText(/Seret gambar ke sini/)).not.toBeInTheDocument();
  });

  it("renders the image in read-only mode", () => {
    mockUseScreenshotBlock.mockReturnValue(mockBlock);
    render(<TestEditor editable={false} screenshotBlockId="shot-1" />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("renders existing annotations on top of the image in read-only mode", () => {
    mockUseScreenshotBlock.mockReturnValue({
      ...mockBlock,
      annotations: [{ id: "a1", type: "marker", order: 1, color: "#fff", x: 0.1, y: 0.1 }],
    });
    render(<TestEditor editable={false} screenshotBlockId="shot-1" />);
    expect(document.querySelector("svg circle")).toBeInTheDocument();
  });

  it("enters annotate mode with the tool palette when the thumbnail is clicked in edit mode", () => {
    mockUseScreenshotBlock.mockReturnValue(mockBlock);
    render(<TestEditor editable={true} screenshotBlockId="shot-1" />);
    fireEvent.click(screen.getByRole("img"));
    expect(screen.getByRole("button", { name: /Kotak/i })).toBeInTheDocument();
  });

  it("exits annotate mode back to the plain thumbnail when 'Selesai' is clicked", () => {
    mockUseScreenshotBlock.mockReturnValue(mockBlock);
    render(<TestEditor editable={true} screenshotBlockId="shot-1" />);
    fireEvent.click(screen.getByRole("img"));
    fireEvent.click(screen.getByRole("button", { name: /Selesai/i }));
    expect(screen.queryByRole("button", { name: /Kotak/i })).not.toBeInTheDocument();
  });

  it("patches annotations locally immediately, then debounce-saves to Supabase after placing a marker", () => {
    vi.useFakeTimers();
    Object.defineProperty(SVGSVGElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}) }),
    });
    mockUseScreenshotBlock.mockReturnValue(mockBlock);
    mockUpdateAnnotations.mockReset().mockResolvedValue(undefined);
    mockPatchAnnotationsLocal.mockClear();

    render(<TestEditor editable={true} screenshotBlockId="shot-1" />);
    fireEvent.click(screen.getByRole("img"));
    fireEvent.click(screen.getByRole("button", { name: /Penanda Bernomor/i }));

    const canvas = document.querySelector('[data-testid="annotation-editor-canvas"]') as SVGSVGElement;
    fireEvent.pointerDown(canvas, { clientX: 40, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 40, clientY: 30, pointerId: 1 });

    expect(mockPatchAnnotationsLocal).toHaveBeenCalledWith("shot-1", [expect.objectContaining({ type: "marker" })]);
    expect(mockUpdateAnnotations).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(mockUpdateAnnotations).toHaveBeenCalledWith("shot-1", [expect.objectContaining({ type: "marker" })]);

    vi.useRealTimers();
  });
});
