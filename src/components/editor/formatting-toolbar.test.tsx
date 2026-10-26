import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { blockTypeItems, EditorFormattingToolbar } from "./formatting-toolbar";
import { editorSchema, type EditorSchema } from "./schema";
import type { PartialBlock } from "@blocknote/core";

type EditorContent = PartialBlock<
  EditorSchema["blockSchema"],
  EditorSchema["inlineContentSchema"],
  EditorSchema["styleSchema"]
>[];

type TestEditor = ReturnType<typeof useCreateBlockNote>;

/**
 * jsdom implements no layout: positioning the floating toolbar asks a text
 * `Range` for client rects (ProseMirror's `coordsAtPos`, via floating-ui) and
 * that method simply doesn't exist here, so the measurement throws before the
 * toolbar can settle. Zero-size rects are enough to let it mount — every
 * assertion in this file is about *what* renders and what it does to the
 * document, never about where the toolbar is drawn.
 */
beforeAll(() => {
  if (typeof Range.prototype.getClientRects !== "function") {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  }
  if (typeof Range.prototype.getBoundingClientRect !== "function") {
    Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
  }
});

const twoRows: EditorContent = [
  { type: "heading", props: { level: 2 }, content: "Bagian pertama" },
  { type: "paragraph", content: "Baris isi di bawah judul." },
];

/**
 * Selecting starts at row 0 leaves BlockNote nothing to indent *into* (the
 * first row has no row above it), so the indent/outdent tests select rows 1-2
 * of a three-row document — the shape a real selection has when the user
 * selects two rows to move deeper.
 */
const threeRows: EditorContent = [
  { type: "heading", props: { level: 2 }, content: "Bagian pertama" },
  { type: "paragraph", content: "Baris isi di bawah judul." },
  { type: "paragraph", content: "Baris ketiga." },
];

/**
 * Mounts a real BlockNoteView (the same composition PageEditor uses: default
 * UI off, formatting toolbar on) and hands back the editor instance so the
 * tests can assert on the document, not just the DOM.
 */
async function renderEditor(initialContent: EditorContent) {
  const holder: { editor?: TestEditor } = {};

  function Mount() {
    const editor = useCreateBlockNote({ schema: editorSchema, initialContent });
    holder.editor = editor;
    return (
      <BlockNoteView
        editor={editor}
        editable={true}
        formattingToolbar={false}
        slashMenu={false}
        linkToolbar={false}
        sideMenu={false}
      >
        <EditorFormattingToolbar />
      </BlockNoteView>
    );
  }

  const { container } = render(<Mount />);
  await waitFor(() => expect(container.querySelector(".bn-editor")).not.toBeNull());
  return { container, editor: holder.editor as TestEditor };
}

function pressKey(container: Element, key: string, options: { shiftKey?: boolean } = {}) {
  const target = container.querySelector(".bn-editor") as Element;
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

/**
 * BlockNote tags its own toolbar buttons with `data-test` (not the Testing
 * Library default `data-testid`), so the hierarchy buttons are found by
 * attribute rather than by configuring a global test id for one file.
 */
function toolbarButton(name: "nestBlock" | "unnestBlock") {
  return document.querySelector<HTMLElement>(`[data-test="${name}"]`);
}

async function findToolbarButton(name: "nestBlock" | "unnestBlock") {
  await waitFor(() => expect(toolbarButton(name), `${name} button`).not.toBeNull());
  return toolbarButton(name) as HTMLElement;
}

describe("blockTypeItems — row type conversion", () => {
  it("offers paragraph, all three heading levels, both list flavours and quote, in Indonesian", () => {
    const conversions = blockTypeItems.map((item) => `${item.name}:${item.type}`);

    expect(conversions).toContain("Paragraf:paragraph");
    expect(conversions).toContain("Judul 1:heading");
    expect(conversions).toContain("Judul 2:heading");
    expect(conversions).toContain("Judul 3:heading");
    expect(conversions).toContain("Daftar Berpoin:bulletListItem");
    expect(conversions).toContain("Daftar Bernomor:numberedListItem");
    expect(conversions).toContain("Kutipan:quote");
  });

  it("keeps heading conversions inside the hierarchy's own range (levels 1-3)", () => {
    const headingLevels = blockTypeItems.filter((item) => item.type === "heading").map((item) => item.props?.level);

    expect(headingLevels).toEqual([1, 2, 3]);
  });
});

describe("formatting toolbar — hierarchy controls", () => {
  it("mounts the block type selector showing the selected row's type", async () => {
    const { editor } = await renderEditor(twoRows);

    act(() => {
      editor.setSelection(editor.document[0].id, editor.document[1].id);
    });

    // The first selected row is the H2, so the converter reports that level.
    expect(await screen.findByText("Judul 2")).toBeInTheDocument();
  });

  it("renders indent/outdent for an editable selection", async () => {
    const { editor } = await renderEditor(threeRows);

    act(() => {
      editor.setSelection(editor.document[1].id, editor.document[2].id);
    });

    await findToolbarButton("nestBlock");
    await findToolbarButton("unnestBlock");
  });

  it("indents the selected rows into the row above them when the indent button is clicked", async () => {
    const user = userEvent.setup();
    const { editor } = await renderEditor(threeRows);

    act(() => {
      editor.setSelection(editor.document[1].id, editor.document[2].id);
    });
    await user.click(await findToolbarButton("nestBlock"));

    // Both selected rows drop inside the row above them.
    await waitFor(() => expect(editor.document).toHaveLength(1));
    const [parent, ...rest] = editor.document;
    expect(rest).toHaveLength(0);
    expect(parent.type).toBe("heading");
    expect(parent.children.map((child: { type: string }) => child.type)).toEqual(["paragraph", "paragraph"]);
    // The nested rows keep their own content — only their parent changed.
    expect(parent.children[0].content).toEqual([{ type: "text", text: "Baris isi di bawah judul.", styles: {} }]);
    expect(parent.children[1].content).toEqual([{ type: "text", text: "Baris ketiga.", styles: {} }]);
  });

  it("lifts nested rows back to the top level with the outdent button", async () => {
    const user = userEvent.setup();
    const { editor } = await renderEditor(threeRows);

    act(() => {
      editor.setSelection(editor.document[1].id, editor.document[2].id);
    });
    await user.click(await findToolbarButton("nestBlock"));
    await waitFor(() => expect(editor.document).toHaveLength(1));

    await user.click(await findToolbarButton("unnestBlock"));

    await waitFor(() => expect(editor.document).toHaveLength(3));
    expect(editor.document.map((block: { type: string }) => block.type)).toEqual(["heading", "paragraph", "paragraph"]);
  });
});

describe("hierarchy keyboard behaviour", () => {
  it("indents the current row with Tab", async () => {
    const { container, editor } = await renderEditor(twoRows);

    act(() => {
      editor.setTextCursorPosition(editor.document[1].id, "start");
    });
    pressKey(container, "Tab");

    await waitFor(() => expect(editor.document).toHaveLength(1));
    expect(editor.document[0].children.map((child: { type: string }) => child.type)).toEqual(["paragraph"]);
  });

  it("removes the indentation again with Shift+Tab", async () => {
    const { container, editor } = await renderEditor(twoRows);

    act(() => {
      editor.setTextCursorPosition(editor.document[1].id, "start");
    });
    pressKey(container, "Tab");
    await waitFor(() => expect(editor.document).toHaveLength(1));

    pressKey(container, "Tab", { shiftKey: true });

    await waitFor(() => expect(editor.document).toHaveLength(2));
    expect(editor.document.map((block: { type: string }) => block.type)).toEqual(["heading", "paragraph"]);
  });

  it("leaves Tab to toolbar navigation while a toolbar is open, instead of indenting", async () => {
    const { container, editor } = await renderEditor(twoRows);

    // A non-empty selection opens the floating toolbar — the case where the
    // user needs Tab to move between editor UI elements rather than indent.
    act(() => {
      editor.setSelection(editor.document[0].id, editor.document[1].id);
    });
    await findToolbarButton("nestBlock");

    pressKey(container, "Tab");

    // Handled as navigation: the document keeps both rows, un-nested.
    expect(editor.document).toHaveLength(2);
    expect(editor.document[1].children).toHaveLength(0);
  });

  it("starts a new row with Enter", async () => {
    const { container, editor } = await renderEditor(twoRows);

    act(() => {
      editor.setTextCursorPosition(editor.document[1].id, "end");
    });
    pressKey(container, "Enter");

    await waitFor(() => expect(editor.document).toHaveLength(3));
    expect(editor.document[2].type).toBe("paragraph");
  });
});
