"use client";

import { Plus, Trash2 } from "lucide-react";
import { createReactBlockSpec, useEditorState, type ReactCustomBlockRenderProps } from "@blocknote/react";
import type { BlockNoteEditor } from "@blocknote/core";

/**
 * A GitBook-style stepper is two cooperating block types, not one:
 *  - `stepper` — a pure container (content: "none"). It has no visible
 *    content of its own; its `children` (BlockNote's native block-nesting,
 *    not a custom prop) ARE the steps.
 *  - `step` — one step. Its `title` prop is a plain string (editable via a
 *    controlled <input>, not BlockNote inline content — a content:"inline"
 *    step was tried first, but BlockNote's React node-view renderer for
 *    "inline" blocks discards every sibling around the `contentRef` element,
 *    confirmed by direct DOM inspection with a minimal repro, so a title
 *    living next to a circle/buttons has to be a plain prop instead).
 *    Its `children` are the step's body — arbitrary nested blocks
 *    (paragraphs, images, tables, even another `stepper`), because
 *    BlockNote nesting is generic and unrestricted by block type.
 *    BlockNote props only support string/number/boolean (@blocknote/core's
 *    PropSchema), so nesting is the only mechanism that can hold "arbitrary
 *    nested blocks" — and it's rendered automatically outside this file's
 *    `render` functions (see globals.css for the numbering/connector-line
 *    CSS that reaches into that auto-rendered nested DOM).
 */

export const stepBlockConfig = {
  type: "step",
  propSchema: {
    title: { default: "" },
  },
  content: "none",
} as const;

export const stepperBlockConfig = {
  type: "stepper",
  propSchema: {},
  content: "none",
} as const;

type StepRenderProps = ReactCustomBlockRenderProps<typeof stepBlockConfig>;
type StepperRenderProps = ReactCustomBlockRenderProps<typeof stepperBlockConfig>;

/**
 * `ReactCustomBlockRenderProps` narrows `editor`'s schema generic to a
 * single-entry `Record<"step" | "stepper", ...>`, so TypeScript sees the
 * *other* custom block type as unreachable (e.g. comparing a step's parent's
 * `.type` to `"stepper"` is flagged as a comparison with "no overlap").
 * Both blocks only exist together in the real, full `editorSchema`, which
 * this file can't import without a circular dependency (schema.ts imports
 * *this* file). Widening to `any` locally for the specific cross-block-type
 * calls below is the narrow, contained fix.
 */
type AnyBlockNoteEditor = BlockNoteEditor<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function StepBlockRender({ block, editor }: StepRenderProps) {
  const readOnly = !editor.isEditable;
  // BlockNote's custom "dom"-type node views only re-render when *this*
  // block's own attrs/content change (confirmed live: inserting or removing
  // a *sibling* step left every other step's number frozen at its old
  // value). A step's number and remove-eligibility both depend on its
  // siblings, so they need `useEditorState`'s editor-wide transaction
  // subscription to stay current — the same pattern BlockNote's own
  // ToggleWrapper uses for its reactive child count.
  const { number, canRemove } = useEditorState({
    editor: editor as AnyBlockNoteEditor,
    selector: () => {
      const parent = (editor as AnyBlockNoteEditor).getParentBlock(block.id);
      const siblingSteps = parent && parent.type === "stepper" ? parent.children.filter((child: { type: string }) => child.type === "step") : [];
      const index = siblingSteps.findIndex((sibling: { id: string }) => sibling.id === block.id);
      return { number: index === -1 ? 1 : index + 1, canRemove: siblingSteps.length > 1 };
    },
  });

  function handleTitleChange(value: string) {
    editor.updateBlock(block, { type: "step", props: { title: value } });
  }

  function handleRemove() {
    if (!canRemove) return;
    editor.removeBlocks([block.id]);
  }

  function handleInsertAfter() {
    (editor as AnyBlockNoteEditor).insertBlocks([{ type: "step", children: [{ type: "paragraph" }] }], block.id, "after");
  }

  return (
    <div className="group/step flex w-full gap-3">
      <div className="flex flex-col items-center pt-0.5">
        <span
          aria-label={`Langkah ${number}`}
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-caption font-semibold text-primary-foreground"
        >
          {number}
        </span>
        {!readOnly && (
          <button
            type="button"
            aria-label={`Tambah langkah setelah langkah ${number}`}
            onClick={handleInsertAfter}
            className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover/step:opacity-100"
          >
            <Plus className="size-3" />
          </button>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-start gap-2">
        {readOnly ? (
          <p className="w-full min-w-0 flex-1 pt-0.5 text-body-sm font-semibold text-foreground">{block.props.title || `Langkah ${number}`}</p>
        ) : (
          <input
            aria-label={`Judul langkah ${number}`}
            value={block.props.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder={`Langkah ${number}`}
            className="w-full min-w-0 flex-1 truncate bg-transparent pt-0.5 text-body-sm font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
          />
        )}
        {!readOnly && canRemove && (
          <button
            type="button"
            aria-label={`Hapus langkah ${number}`}
            onClick={handleRemove}
            className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover/step:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function StepperBlockRender({ block, editor }: StepperRenderProps) {
  const readOnly = !editor.isEditable;
  // Same staleness concern as StepBlockRender's number/canRemove: a step
  // being removed elsewhere doesn't recreate *this* node view, so `block`
  // itself can go stale — read children count reactively instead.
  const hasSteps = useEditorState({
    editor: editor as AnyBlockNoteEditor,
    selector: () => ((editor as AnyBlockNoteEditor).getBlock(block.id)?.children.length ?? 0) > 0,
  });

  if (hasSteps || readOnly) return null;

  return (
    <button
      type="button"
      onClick={() => (editor as AnyBlockNoteEditor).updateBlock(block.id, { children: [{ type: "step", children: [{ type: "paragraph" }] }] })}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-body-sm text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <Plus className="size-3.5" />
      Tambah langkah
    </button>
  );
}

export const stepBlockSpec = createReactBlockSpec(stepBlockConfig, {
  render: StepBlockRender,
})();

export const stepperBlockSpec = createReactBlockSpec(stepperBlockConfig, {
  render: StepperBlockRender,
})();
