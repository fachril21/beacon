import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
