import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { editorSchema } from "./schema";
import { ensureTrailingParagraph, trailingParagraphExtension } from "./trailing-paragraph-extension";
import { PageIdProvider } from "./page-id-context";
import { screenshotBlock, divider, paragraph } from "@/lib/mock/blocknote-content";

vi.mock("@/hooks/use-screenshot-blocks", () => ({
  useScreenshotBlock: () => undefined,
  useUploadScreenshot: () => vi.fn(),
  useUpdateScreenshotAnnotation: () => vi.fn(),
  useUpdateScreenshotDescription: () => vi.fn(),
}));

type EditorInitialContent = PartialBlock<
  typeof editorSchema.blockSchema,
  typeof editorSchema.inlineContentSchema,
  typeof editorSchema.styleSchema
>[];

function createTestEditor(initialContent: EditorInitialContent) {
  return BlockNoteEditor.create({ schema: editorSchema, initialContent });
}

describe("ensureTrailingParagraph", () => {
  it("appends an empty paragraph after a content-less block (screenshot) that is currently last", () => {
    const editor = createTestEditor([screenshotBlock("shot-1")]);

    ensureTrailingParagraph(editor);

    expect(editor.document).toHaveLength(2);
    expect(editor.document[1].type).toBe("paragraph");
  });

  it("appends an empty paragraph after a content-less block (divider) that is currently last", () => {
    const editor = createTestEditor([divider()]);

    ensureTrailingParagraph(editor);

    expect(editor.document).toHaveLength(2);
    expect(editor.document[1].type).toBe("paragraph");
  });

  it("does not add a second trailing paragraph when one already exists", () => {
    const editor = createTestEditor([screenshotBlock("shot-1"), paragraph("")]);

    ensureTrailingParagraph(editor);

    expect(editor.document).toHaveLength(2);
  });

  it("leaves the document untouched when the last block already has editable content", () => {
    const editor = createTestEditor([paragraph("hello")]);

    ensureTrailingParagraph(editor);

    expect(editor.document).toHaveLength(1);
  });

  it("does nothing when the editor is read-only", () => {
    const editor = createTestEditor([screenshotBlock("shot-1")]);
    editor.isEditable = false;

    ensureTrailingParagraph(editor);

    expect(editor.document).toHaveLength(1);
  });
});

function TestEditor({ initialContent }: { initialContent: EditorInitialContent }) {
  const editor = useCreateBlockNote({
    schema: editorSchema,
    initialContent,
    extensions: [trailingParagraphExtension()],
  });
  return (
    <PageIdProvider pageId="page-1">
      <BlockNoteView editor={editor} editable={true} formattingToolbar={false} slashMenu={false} linkToolbar={false} sideMenu={false} />
    </PageIdProvider>
  );
}

describe("trailingParagraphExtension", () => {
  it("fixes up an already-loaded document whose last block is a screenshot, once mounted", async () => {
    const { container } = render(<TestEditor initialContent={[screenshotBlock("shot-1")]} />);

    await waitFor(() => {
      const blocks = container.querySelectorAll('[data-node-type="blockOuter"]');
      expect(blocks).toHaveLength(2);
      expect(blocks[1].querySelector('[data-content-type="paragraph"]')).not.toBeNull();
    });
  });
});
