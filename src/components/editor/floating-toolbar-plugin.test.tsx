import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $createParagraphNode, $createTextNode, type LexicalEditor } from "lexical";
import { CodeNode, $createCodeNode } from "@lexical/code";
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
        nodes: [CodeNode, LinkNode],
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

describe("FloatingToolbarPlugin", () => {
  it("does not render on mount with no selection", () => {
    renderEditor();
    expect(screen.queryByRole("button", { name: "Tebal" })).not.toBeInTheDocument();
  });

  it("shows the format toolbar when a non-collapsed text selection exists", () => {
    const editor = renderEditor();
    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        const text = $createTextNode("hello world");
        paragraph.append(text);
        $getRoot().clear().append(paragraph);
        text.select(0, 5);
      },
      { discrete: true },
    );

    expect(screen.getByRole("button", { name: "Tebal" })).toBeInTheDocument();
  });

  it("hides the toolbar when the selection is collapsed", () => {
    const editor = renderEditor();
    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        const text = $createTextNode("hello world");
        paragraph.append(text);
        $getRoot().clear().append(paragraph);
        text.select(2, 2);
      },
      { discrete: true },
    );

    expect(screen.queryByRole("button", { name: "Tebal" })).not.toBeInTheDocument();
  });

  it("hides the toolbar when the selection is inside a code block", () => {
    const editor = renderEditor();
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

    expect(screen.queryByRole("button", { name: "Tebal" })).not.toBeInTheDocument();
  });

  it("hides the format toolbar when the selection is inside a link (link editor takes over)", () => {
    const editor = renderEditor();
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

    expect(screen.queryByRole("button", { name: "Tebal" })).not.toBeInTheDocument();
  });

  it("dispatches bold formatting on the selection when the Bold button is clicked", async () => {
    const user = userEvent.setup();
    const editor = renderEditor();
    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        const text = $createTextNode("hello world");
        paragraph.append(text);
        $getRoot().clear().append(paragraph);
        text.select(0, 5);
      },
      { discrete: true },
    );

    await user.click(screen.getByRole("button", { name: "Tebal" }));

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const paragraph = root.getFirstChildOrThrow();
      const text = paragraph.getFirstChildOrThrow() as import("lexical").TextNode;
      expect(text.hasFormat("bold")).toBe(true);
    });
  });

  it("wraps the selection in a link when the Link button is clicked", async () => {
    const user = userEvent.setup();
    const editor = renderEditor();
    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        const text = $createTextNode("hello world");
        paragraph.append(text);
        $getRoot().clear().append(paragraph);
        text.select(0, 5);
      },
      { discrete: true },
    );

    await user.click(screen.getByRole("button", { name: "Tautan" }));

    editor.getEditorState().read(() => {
      const root = $getRoot();
      const paragraph = root.getFirstChildOrThrow();
      const firstChild = paragraph.getFirstChildOrThrow();
      expect($isLinkNode(firstChild)).toBe(true);
    });
  });
});
