import { describe, it, expect } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { editorSchema } from "./schema";
import { codeBlockExitExtension } from "./code-block-exit-extension";

function createTestEditor(codeText: string) {
  return BlockNoteEditor.create({
    schema: editorSchema,
    initialContent: [{ type: "codeBlock", props: { language: "javascript" }, content: codeText }],
    extensions: [codeBlockExitExtension],
  });
}

/** Invokes the extension's Enter handler directly — mirrors how ProseMirror's keymap plugin would call it, without depending on jsdom's limited contentEditable/keyboard-event support. */
function pressEnter(editor: ReturnType<typeof createTestEditor>) {
  const extension = editor.extensions.get("codeBlockExit");
  return extension!.keyboardShortcuts!.Enter!({ editor });
}

describe("codeBlockExitExtension", () => {
  it("exits the code block to a new paragraph when Enter is pressed on an already-empty trailing line", () => {
    const editor = createTestEditor("console.log(1);\n");
    editor.setTextCursorPosition(editor.document[0], "end");

    const handled = pressEnter(editor);

    expect(handled).toBe(true);
    expect(editor.document).toHaveLength(2);
    expect(editor.document[1].type).toBe("paragraph");
  });

  it("leaves the code block untouched when the trailing line still has content", () => {
    const editor = createTestEditor("console.log(1);");
    editor.setTextCursorPosition(editor.document[0], "end");

    const handled = pressEnter(editor);

    expect(handled).toBe(false);
    expect(editor.document).toHaveLength(1);
  });

  it("does not intercept Enter outside a code block", () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [{ type: "paragraph", content: "hello" }],
      extensions: [codeBlockExitExtension],
    });
    editor.setTextCursorPosition(editor.document[0], "end");

    const handled = pressEnter(editor);

    expect(handled).toBe(false);
    expect(editor.document).toHaveLength(1);
  });
});
