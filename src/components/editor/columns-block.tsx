"use client";

import { Minus, Plus } from "lucide-react";
import { createReactBlockSpec, useEditorState, type ReactCustomBlockRenderProps } from "@blocknote/react";
import type { BlockNoteEditor, PartialBlock } from "@blocknote/core";

export const columnsBlockConfig = {
  type: "columns",
  propSchema: {},
  content: "none",
} as const;

export const columnBlockConfig = {
  type: "column",
  propSchema: {},
  content: "none",
} as const;

type ColumnsRenderProps = ReactCustomBlockRenderProps<typeof columnsBlockConfig>;
type AnyEditor = ColumnsRenderProps["editor"] & {
  insertBlocks: (blocks: PartialBlock<any, any, any>[], referenceBlock: string, placement: "before" | "after") => unknown; // eslint-disable-line @typescript-eslint/no-explicit-any
};

const newColumn = (): PartialBlock<any, any, any> => ({ type: "column", children: [{ type: "paragraph" }] }); // eslint-disable-line @typescript-eslint/no-explicit-any

function ColumnsBlockRender({ block, editor }: ColumnsRenderProps) {
  // BlockNote's custom node view only re-renders when *this* block changes;
  // adding/removing a column changes its children, so the count and the ids
  // used by the buttons must come from the live document.
  const columnIds = useEditorState({
    editor: editor as unknown as BlockNoteEditor,
    selector: () => {
      const current = (editor as unknown as BlockNoteEditor).getBlock(block.id);
      const children = (current?.children ?? []) as unknown as { id: string; type: string }[];
      return children.filter((child) => child.type === "column").map((child) => child.id);
    },
  });
  const canRemove = columnIds.length > 2;

  function addColumn() {
    const last = columnIds[columnIds.length - 1];
    if (!last) return;
    const anyEditor = editor as AnyEditor;
    anyEditor.insertBlocks([newColumn()], last, "after");
  }

  function removeColumn() {
    const last = columnIds[columnIds.length - 1];
    if (!last || !canRemove) return;
    editor.removeBlocks([last]);
  }

  return (
    <div className="beacon-columns" contentEditable={false}>
      {editor.isEditable && (
        <>
          <span className="beacon-columns-label">{columnIds.length} kolom</span>
          <span className="beacon-columns-controls">
            <button
              type="button"
              onClick={removeColumn}
              disabled={!canRemove}
              aria-label="Kurangi kolom"
              className="beacon-columns-button"
            >
              <Minus className="size-3" />
            </button>
            <button type="button" onClick={addColumn} aria-label="Tambah kolom" className="beacon-columns-button">
              <Plus className="size-3" />
            </button>
          </span>
        </>
      )}
    </div>
  );
}

function ColumnBlockRender() {
  return <div className="beacon-column" contentEditable={false} />;
}

export const columnsBlockSpec = createReactBlockSpec(columnsBlockConfig, {
  render: ColumnsBlockRender,
})();

export const columnBlockSpec = createReactBlockSpec(columnBlockConfig, {
  render: ColumnBlockRender,
})();
