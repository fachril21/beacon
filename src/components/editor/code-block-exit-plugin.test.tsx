import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $getSelection, $isRangeSelection, $createParagraphNode, $createTextNode, $createLineBreakNode, KEY_ENTER_COMMAND, type LexicalEditor } from "lexical";
import { CodeNode, $createCodeNode, $isCodeNode } from "@lexical/code";
import { CodeBlockExitPlugin } from "./code-block-exit-plugin";

// jsdom doesn't implement Range measurement APIs; Lexical's DOM-selection
// sync calls these on every commit. Standard workaround for Lexical + jsdom.
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

function renderEditorWithCodeBlock() {
  let editor!: LexicalEditor;

  render(
    <LexicalComposer
      initialConfig={{
        namespace: "test",
        nodes: [CodeNode],
        onError: (e) => {
          throw e;
        },
      }}
    >
      <Harness onReady={(e) => (editor = e)} />
      <CodeBlockExitPlugin />
      <RichTextPlugin
        contentEditable={<ContentEditable aria-label="editor" />}
        placeholder={null}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
    </LexicalComposer>,
  );

  screen.getByLabelText("editor").focus();
  return editor;
}

describe("CodeBlockExitPlugin", () => {
  it("leaves a code block untouched (stays the only node) when the cursor is on a non-empty line", () => {
    const editor = renderEditorWithCodeBlock();
    editor.update(
      () => {
        const code = $createCodeNode();
        code.append($createTextNode("console.log(1)"));
        $getRoot().clear().append(code);
        code.selectEnd();
      },
      { discrete: true },
    );

    editor.dispatchCommand(KEY_ENTER_COMMAND, null);
    editor.update(() => {}, { discrete: true }); // force-flush the batched update from dispatchCommand

    editor.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children).toHaveLength(1);
      expect($isCodeNode(children[0])).toBe(true);
    });
  });

  it("exits the code block into a new paragraph when Enter is pressed on an already-empty trailing line", () => {
    const editor = renderEditorWithCodeBlock();
    editor.update(
      () => {
        const code = $createCodeNode();
        code.append($createTextNode("console.log(1)"));
        code.append($createLineBreakNode());
        $getRoot().clear().append(code);
        code.selectEnd();
      },
      { discrete: true },
    );

    editor.dispatchCommand(KEY_ENTER_COMMAND, null);
    editor.update(() => {}, { discrete: true }); // force-flush the batched update from dispatchCommand

    editor.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children).toHaveLength(2);
      expect($isCodeNode(children[0])).toBe(true);
      expect(children[1].getType()).toBe("paragraph");
    });
  });

  it("leaves normal paragraph Enter behavior unaffected (splits into two paragraphs, not our plugin's concern)", () => {
    const editor = renderEditorWithCodeBlock();
    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode("hello"));
        $getRoot().clear().append(paragraph);
        paragraph.selectEnd();
      },
      { discrete: true },
    );

    editor.dispatchCommand(KEY_ENTER_COMMAND, null);
    editor.update(() => {}, { discrete: true }); // force-flush the batched update from dispatchCommand

    editor.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children.length).toBeGreaterThanOrEqual(1);
      expect(children.every((c) => c.getType() === "paragraph")).toBe(true);
    });
  });
});
