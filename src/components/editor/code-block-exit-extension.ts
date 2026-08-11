import { createExtension } from "@blocknote/core";

/**
 * BlockNote's codeBlock keeps Enter as "insert a newline within this code
 * block" (correct for editing multi-line code), which leaves no way to leave
 * the block via keyboard when it's the last block in the document — nothing
 * below it to click into. Pressing Enter again on an already-empty trailing
 * line exits to a new paragraph after the code block (Notion-style
 * double-Enter), matching the prior Lexical CodeBlockExitPlugin's behavior.
 */
export const codeBlockExitExtension = createExtension({
  key: "codeBlockExit",
  keyboardShortcuts: {
    Enter: ({ editor }) => {
      const cursor = editor.getTextCursorPosition();
      if (cursor.block.type !== "codeBlock") return false;

      const { selection } = editor.prosemirrorState;
      if (!selection.empty) return false;

      const { $from } = selection;
      const atEndOfBlock = $from.parentOffset === $from.parent.content.size;
      if (!atEndOfBlock) return false;

      const fullText = $from.parent.textContent;
      const currentLineIsEmpty = fullText.length > 0 && fullText.endsWith("\n");
      if (!currentLineIsEmpty) return false;

      const [inserted] = editor.insertBlocks([{ type: "paragraph" }], cursor.block, "after");
      if (inserted) editor.setTextCursorPosition(inserted, "start");
      return true;
    },
  },
});
