"use client";

import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, $createParagraphNode, KEY_ENTER_COMMAND, COMMAND_PRIORITY_HIGH } from "lexical";
import { $isCodeNode } from "@lexical/code";

/**
 * Lexical's CodeNode keeps Enter as "insert a newline within this code
 * block" (correct for editing multi-line code), which leaves no way to
 * leave the block via keyboard when it's the last node in the document --
 * nothing below it to click into. Pressing Enter again on an
 * already-empty trailing line exits to a new paragraph after the code
 * block, matching the Notion/Lexical-playground double-Enter convention.
 */
export function CodeBlockExitPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

        const anchorNode = selection.anchor.getNode();
        const codeNode = $isCodeNode(anchorNode) ? anchorNode : anchorNode.getParent();
        if (!codeNode || !$isCodeNode(codeNode)) return false;

        // Two distinct point shapes: a "text" point's offset is a character
        // count into anchorNode; an "element" point's offset is a child
        // index into anchorNode (this is what we get when the last child is
        // a LineBreakNode, since you can't have a text-offset "inside" one).
        const cursorIsAtEndOfBlock =
          selection.anchor.type === "element"
            ? anchorNode.is(codeNode) && selection.anchor.offset === codeNode.getChildrenSize()
            : anchorNode.is(codeNode.getLastDescendant()) && selection.anchor.offset === anchorNode.getTextContentSize();
        if (!cursorIsAtEndOfBlock) return false;

        const fullText = codeNode.getTextContent();
        const currentLineIsEmpty = fullText.length > 0 && fullText.endsWith("\n");
        if (!currentLineIsEmpty) return false;

        event?.preventDefault();
        const paragraph = $createParagraphNode();
        codeNode.insertAfter(paragraph);
        paragraph.selectStart();
        return true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}
