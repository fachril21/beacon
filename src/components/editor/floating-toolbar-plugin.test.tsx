import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $createParagraphNode, $createTextNode, type LexicalEditor, type TextNode, type ElementNode } from "lexical";
import { CodeNode, $createCodeNode } from "@lexical/code";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { LinkNode, $createLinkNode, $isLinkNode } from "@lexical/link";
import { FloatingToolbarPlugin } from "./floating-toolbar-plugin";

beforeAll(() => {
  Range.prototype.getBoundingClientRect = () =>
    ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
});

function Harness({ onReady }: { onReady: (editor: LexicalEditor) => void }) {
  const [editor] = useLexicalComposerContext();
  onReady(editor);
  return null;
}

function renderEditor() {
  let editor!: LexicalEditor;

  render(
    <LexicalComposer
      initialConfig={{
        namespace: "test",
        nodes: [CodeNode, LinkNode, HeadingNode, QuoteNode],
        onError: (e) => {
          throw e;
        },
      }}
    >
      <Harness onReady={(e) => (editor = e)} />
      <RichTextPlugin
        contentEditable={<ContentEditable aria-label="editor" />}
        placeholder={null}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <LinkPlugin />
      <FloatingToolbarPlugin />
    </LexicalComposer>,
  );

  screen.getByLabelText("editor").focus();
  return editor;
}

function selectPlainText(editor: LexicalEditor, anchorOffset: number, focusOffset: number) {
  act(() => {
    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        const text = $createTextNode("hello world");
        paragraph.append(text);
        $getRoot().clear().append(paragraph);
        text.select(anchorOffset, focusOffset);
      },
      { discrete: true },
    );
  });
}

describe("FloatingToolbarPlugin", () => {
  it("does not render on mount with no selection", () => {
    renderEditor();
    expect(screen.queryByRole("button", { name: "Tebal" })).not.toBeInTheDocument();
  });

  it("shows the format toolbar when a non-collapsed text selection exists", () => {
    const editor = renderEditor();
    selectPlainText(editor, 0, 5);
    expect(screen.getByRole("button", { name: "Tebal" })).toBeInTheDocument();
  });

  it("hides the toolbar once the selection collapses again", () => {
    const editor = renderEditor();
    selectPlainText(editor, 0, 5);
    expect(screen.getByRole("button", { name: "Tebal" })).toBeInTheDocument();

    act(() => {
      editor.update(
        () => {
          const paragraph = $getRoot().getFirstChildOrThrow<ElementNode>();
          const text = paragraph.getFirstChildOrThrow() as TextNode;
          text.select(2, 2);
        },
        { discrete: true },
      );
    });

    expect(screen.queryByRole("button", { name: "Tebal" })).not.toBeInTheDocument();
  });

  it("never shows the toolbar for a selection inside a code block", () => {
    const editor = renderEditor();
    act(() => {
      editor.update(
        () => {
          const code = $createCodeNode();
          const text = $createTextNode("console.log(1)");
          code.append(text);
          $getRoot().clear().append(code);
          text.select(0, 5);
        },
        { discrete: true },
      );
    });

    expect(screen.queryByRole("button", { name: "Tebal" })).not.toBeInTheDocument();
  });

  it("defers to the link editor instead of showing the format toolbar on a link selection", () => {
    const editor = renderEditor();
    act(() => {
      editor.update(
        () => {
          const paragraph = $createParagraphNode();
          const link = $createLinkNode("https://example.com");
          const text = $createTextNode("click here");
          link.append(text);
          paragraph.append(link);
          $getRoot().clear().append(paragraph);
          text.select(0, 5);
        },
        { discrete: true },
      );
    });

    expect(screen.queryByRole("button", { name: "Tebal" })).not.toBeInTheDocument();
  });

  it("dispatches bold formatting on the selection when the Bold button is clicked", async () => {
    const user = userEvent.setup();
    const editor = renderEditor();
    selectPlainText(editor, 0, 5);

    await user.click(screen.getByRole("button", { name: "Tebal" }));

    editor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow<ElementNode>();
      const text = paragraph.getFirstChildOrThrow() as TextNode;
      expect(text.hasFormat("bold")).toBe(true);
    });
  });

  it("wraps the selection in a link when the Link button is clicked", async () => {
    const user = userEvent.setup();
    const editor = renderEditor();
    selectPlainText(editor, 0, 5);

    await user.click(screen.getByRole("button", { name: "Tautan" }));

    editor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow<ElementNode>();
      const firstChild = paragraph.getFirstChildOrThrow();
      expect($isLinkNode(firstChild)).toBe(true);
    });
  });

  it.each([
    ["Judul 1", "h1"],
    ["Judul 2", "h2"],
  ] as const)("turns the selected block into a %s heading via the %s button", async (label, tag) => {
    const user = userEvent.setup();
    const editor = renderEditor();
    selectPlainText(editor, 0, 5);

    await user.click(screen.getByRole("button", { name: label }));

    editor.getEditorState().read(() => {
      const block = $getRoot().getFirstChildOrThrow<HeadingNode>();
      expect(block.getType()).toBe("heading");
      expect(block.getTag()).toBe(tag);
    });
  });

  it("turns the selected block into a quote via the Kutipan button", async () => {
    const user = userEvent.setup();
    const editor = renderEditor();
    selectPlainText(editor, 0, 5);

    await user.click(screen.getByRole("button", { name: "Kutipan" }));

    editor.getEditorState().read(() => {
      expect($getRoot().getFirstChildOrThrow<ElementNode>().getType()).toBe("quote");
    });
  });

  it("turns a heading back into a plain paragraph via the Paragraf button", async () => {
    const user = userEvent.setup();
    const editor = renderEditor();
    selectPlainText(editor, 0, 5);
    await user.click(screen.getByRole("button", { name: "Judul 1" }));

    await user.click(screen.getByRole("button", { name: "Paragraf" }));

    editor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow<ElementNode>();
      expect(paragraph.getType()).toBe("paragraph");
    });
  });
});
