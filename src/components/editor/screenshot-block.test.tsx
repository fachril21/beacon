import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { editorSchema } from "./schema";
import { PageIdProvider } from "./page-id-context";
import type { ScreenshotBlock } from "@/lib/types";

vi.mock("./comment-thread-panel", () => ({ CommentThreadPanel: () => null }));

const mockUseScreenshotBlock = vi.fn();
vi.mock("@/hooks/use-screenshot-blocks", () => ({
  useScreenshotBlock: (id?: string) => mockUseScreenshotBlock(id),
  useUploadScreenshot: () => vi.fn(),
  useUpdateScreenshotDescription: () => vi.fn(),
}));

const mockOpenAnnotationFocus = vi.fn();
vi.mock("@/lib/annotation-focus-store", () => ({
  openAnnotationFocus: (blockId: string) => mockOpenAnnotationFocus(blockId),
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

function TestEditor({
  editable,
  screenshotBlockId,
  displayWidth,
  alignment,
}: {
  editable: boolean;
  screenshotBlockId: string;
  displayWidth?: number;
  alignment?: "left" | "center" | "right";
}) {
  const editor = useCreateBlockNote({
    schema: editorSchema,
    initialContent: [
      {
        type: "screenshot",
        props: {
          screenshotBlockId,
          ...(displayWidth === undefined ? {} : { displayWidth }),
          ...(alignment === undefined ? {} : { alignment }),
        },
      },
    ],
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

  it("keeps the saved width and alignment in the read-only render used by published pages", () => {
    mockUseScreenshotBlock.mockReturnValue(mockBlock);
    const { container } = render(<TestEditor editable={false} screenshotBlockId="shot-1" displayWidth={60} alignment="center" />);

    const row = container.querySelector('[data-image-alignment="center"]');
    expect(row).not.toBeNull();
    expect(row).toHaveAttribute("data-image-width", "60");
    expect(row?.querySelector("figure")).toHaveStyle({ width: "60%" });
    expect(screen.queryByRole("group", { name: /perataan gambar/i })).not.toBeInTheDocument();
  });

  it("lets authors resize and align the image from the inline controls", async () => {
    mockUseScreenshotBlock.mockReturnValue(mockBlock);
    const { container } = render(<TestEditor editable={true} screenshotBlockId="shot-1" displayWidth={60} alignment="left" />);

    const slider = await screen.findByRole("slider", { name: /ukuran gambar \(persen\)/i });
    fireEvent.change(slider, { target: { value: "85" } });
    fireEvent.blur(slider);
    await waitFor(() => expect(container.querySelector("[data-image-width]")).toHaveAttribute("data-image-width", "85"));

    fireEvent.click(screen.getByRole("button", { name: /rata kanan/i }));
    await waitFor(() => expect(container.querySelector("[data-image-alignment]")).toHaveAttribute("data-image-alignment", "right"));
  });

  it("resizes the image with the keyboard from the corner handle", async () => {
    mockUseScreenshotBlock.mockReturnValue(mockBlock);
    const { container } = render(<TestEditor editable={true} screenshotBlockId="shot-1" displayWidth={60} alignment="left" />);

    const handle = await screen.findByRole("slider", { name: /tarik untuk mengubah ukuran gambar/i });
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    await waitFor(() => expect(container.querySelector("[data-image-width]")).toHaveAttribute("data-image-width", "65"));
  });

  it("renders existing annotations on top of the image in read-only mode", () => {
    mockUseScreenshotBlock.mockReturnValue({
      ...mockBlock,
      annotations: [{ id: "a1", type: "marker", order: 1, color: "#fff", x: 0.1, y: 0.1 }],
    });
    render(<TestEditor editable={false} screenshotBlockId="shot-1" />);
    expect(document.querySelector("svg circle")).toBeInTheDocument();
  });

  it("opens the full-screen annotation focus mode when the thumbnail is clicked in edit mode", () => {
    mockUseScreenshotBlock.mockReturnValue(mockBlock);
    render(<TestEditor editable={true} screenshotBlockId="shot-1" />);
    fireEvent.click(screen.getByRole("img"));
    expect(mockOpenAnnotationFocus).toHaveBeenCalledWith("shot-1");
  });

  it("opens the focus mode from the Edit anotasi pill too", () => {
    mockUseScreenshotBlock.mockReturnValue(mockBlock);
    render(<TestEditor editable={true} screenshotBlockId="shot-1" />);
    fireEvent.click(screen.getByRole("button", { name: /edit anotasi/i }));
    expect(mockOpenAnnotationFocus).toHaveBeenCalledWith("shot-1");
  });
});
