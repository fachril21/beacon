import { createExtension, type BlockNoteEditor } from "@blocknote/core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic across any schema, same escape hatch used in stepper-block.tsx
type AnyBlockNoteEditor = BlockNoteEditor<any, any, any>;

/**
 * BlockNote's built-in "click below the last block to add a paragraph"
 * widget doesn't reliably render when the last block is a content-less
 * custom block (screenshot, divider, stepper): confirmed live that on a
 * freshly loaded page whose last block is a screenshot, the widget never
 * appears — its decoration state comes out empty on the very first
 * computation and nothing subsequently recomputes it, leaving no way to add
 * a block below. This appends a real trailing paragraph instead of relying
 * on that decoration, so there's always somewhere to click or type past it.
 */
export function ensureTrailingParagraph(editor: AnyBlockNoteEditor): void {
  if (!editor.isEditable) return;

  const blocks = editor.document;
  const last = blocks[blocks.length - 1];
  if (!last) return;

  const lastBlockSpec = editor.schema.blockSchema[last.type];
  if (lastBlockSpec?.content !== "none") return;

  editor.insertBlocks([{ type: "paragraph" }], last, "after");
}

export const trailingParagraphExtension = createExtension(({ editor }) => ({
  key: "trailingParagraph",
  mount() {
    ensureTrailingParagraph(editor);
    return editor.onChange(() => ensureTrailingParagraph(editor));
  },
}));
