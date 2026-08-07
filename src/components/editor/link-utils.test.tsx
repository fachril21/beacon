import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getRoot,
  $getSelection,
  $createParagraphNode,
  $createTextNode,
  $createRangeSelection,
  $setSelection,
  type LexicalEditor,
} from "lexical";
import { LinkNode, $createLinkNode } from "@lexical/link";
import { $getSelectedLinkNode } from "./link-utils";

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
        nodes: [LinkNode],
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
    </LexicalComposer>,
  );

  screen.getByLabelText("editor").focus();
  return editor;
}

describe("$getSelectedLinkNode", () => {
  it("returns null when the selection is plain text with no link ancestor", () => {
    const editor = renderEditor();
    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        const text = $createTextNode("hello");
        paragraph.append(text);
        $getRoot().clear().append(paragraph);
        text.select(1, 1);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      expect($getSelectedLinkNode($getSelection())).toBeNull();
    });
  });

  it("returns the LinkNode when the anchor text node's parent is a link", () => {
    const editor = renderEditor();
    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        const link = $createLinkNode("https://example.com");
        const text = $createTextNode("click here");
        link.append(text);
        paragraph.append(link);
        $getRoot().clear().append(paragraph);
        text.select(2, 2);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const found = $getSelectedLinkNode($getSelection());
      expect(found).not.toBeNull();
      expect(found?.getURL()).toBe("https://example.com");
    });
  });

  it("returns the LinkNode when the selection's anchor point is the link element itself", () => {
    const editor = renderEditor();
    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        const link = $createLinkNode("https://example.com");
        const text = $createTextNode("click here");
        link.append(text);
        paragraph.append(link);
        $getRoot().clear().append(paragraph);

        const selection = $createRangeSelection();
        selection.anchor.set(link.getKey(), 0, "element");
        selection.focus.set(link.getKey(), 0, "element");
        $setSelection(selection);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const found = $getSelectedLinkNode($getSelection());
      expect(found).not.toBeNull();
      expect(found?.getURL()).toBe("https://example.com");
    });
  });

  it("returns null when selection is null", () => {
    expect($getSelectedLinkNode(null)).toBeNull();
  });
});
