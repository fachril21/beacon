"use client";

import { Plus } from "lucide-react";
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
 *    `render` functions.
 *
 *    The visual structure lives in globals.css (`.bn-block:has(...step)`) and
 *    is deliberately split from the block logic here: the CSS makes each
 *    step a two-column grid [numbered rail | content], places the body group
 *    in the content column, and draws the connector on the block itself so it
 *    spans the step's full height. Geometry is shared between both through
 *    the `--step-*` custom properties, so the circle, title, body, and line
 *    can never drift apart. This file only owns the render/interaction logic.
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

/**
 * The title is a real <input> living inside the node view, while the new step
 * is inserted by BlockNote as a block — the two mount at different times, so
 * retry for a frame or two before giving up. Selecting the text means a user
 * who pressed Enter can immediately type the next title.
 */
function focusStepTitle(stepId: string): void {
  let attempts = 0;
  const tryFocus = () => {
    const input = document.querySelector<HTMLInputElement>(`.bn-block[data-id="${stepId}"] input[aria-label^="Judul langkah"]`);
    if (input) {
      input.focus();
      input.select();
      return;
    }
    attempts += 1;
    if (attempts <= 10) requestAnimationFrame(tryFocus);
  };
  requestAnimationFrame(tryFocus);
}

/** The one step shape shared by every "add step" control: an empty title and
 *  a paragraph body, so the cursor has somewhere to land and "/" works. */
const newStep = (): { type: "step"; children: { type: "paragraph" }[] } => ({
  type: "step",
  children: [{ type: "paragraph" }],
});

/**
 * Deletes a step, plus its container when it was the last one. A stepper with
 * no steps has nothing to render, so keeping the empty container around would
 * leave both the document and the page with a dead block the user can no
 * longer reach (only a legacy empty container gets the recovery "+").
 *
 * Exported because step deletion now lives in the drag-handle menu, which is
 * outside this block's node view.
 */
export function removeStepBlock(editor: AnyBlockNoteEditor, stepId: string): void {
  const parent = editor.getParentBlock(stepId);
  const steps =
    parent && parent.type === "stepper"
      ? parent.children.filter((child: { type: string }) => child.type === "step")
      : [];

  editor.removeBlocks(parent && parent.type === "stepper" && steps.length <= 1 ? [parent.id] : [stepId]);
}

function StepBlockRender({ block, editor }: StepRenderProps) {
  const readOnly = !editor.isEditable;
  // BlockNote's custom "dom"-type node views only re-render when *this*
  // block's own attrs/content change (confirmed live: inserting or removing
  // a *sibling* step left every other step's number frozen at its old
  // value). A step's number, last-step connector, and nesting depth all
  // depend on its siblings/ancestors, so they need
  // `useEditorState`'s editor-wide transaction subscription to stay current
  // — the same pattern BlockNote's own ToggleWrapper uses for its reactive
  // child count.
  const { number, isLast, isNested } = useEditorState({
    editor: editor as AnyBlockNoteEditor,
    selector: () => {
      const parent = (editor as AnyBlockNoteEditor).getParentBlock(block.id);
      const siblingSteps = parent && parent.type === "stepper" ? parent.children.filter((child: { type: string }) => child.type === "step") : [];
      const index = siblingSteps.findIndex((sibling: { id: string }) => sibling.id === block.id);

      // Each `stepper` ancestor is one nesting level. Top-level steps have
      // exactly one (their own stepper); anything deeper recedes visually.
      let stepperAncestors = 0;
      let ancestor = parent;
      while (ancestor) {
        if (ancestor.type === "stepper") stepperAncestors += 1;
        ancestor = (editor as AnyBlockNoteEditor).getParentBlock(ancestor.id);
      }

      return {
        number: index === -1 ? 1 : index + 1,
        isLast: index === -1 || index === siblingSteps.length - 1,
        isNested: stepperAncestors > 1,
      };
    },
  });

  function handleTitleChange(value: string) {
    editor.updateBlock(block, { type: "step", props: { title: value } });
  }

  function handleInsertAfter(focusTitle = false) {
    const [inserted] = (editor as AnyBlockNoteEditor).insertBlocks([newStep()], block.id, "after");
    if (focusTitle && inserted) focusStepTitle(inserted.id);
  }

  return (
    <div
      data-last={isLast ? "true" : "false"}
      data-nested={isNested ? "true" : "false"}
      className="beacon-step flex w-full items-start gap-[var(--step-gutter)]"
    >
      <div className="relative flex w-[var(--step-rail)] shrink-0 flex-col items-center">
        <span
          aria-label={`Langkah ${number}`}
          className="flex size-[var(--step-rail)] shrink-0 items-center justify-center rounded-full bg-secondary text-caption leading-none font-semibold text-muted-foreground"
        >
          {number}
        </span>
        {!readOnly && (
          <button
            type="button"
            aria-label={`Tambah langkah setelah langkah ${number}`}
            onClick={() => handleInsertAfter()}
            className="beacon-step-add absolute top-[calc(var(--step-rail)_+_0.5rem)] left-1/2 z-10 flex size-[calc(var(--step-rail)_-_0.25rem)] -translate-x-1/2 items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground outline-none transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-start">
        {readOnly ? (
          <p className="beacon-step-title w-full min-w-0 flex-1 font-semibold">{block.props.title || "Judul langkah"}</p>
        ) : (
          <input
            aria-label={`Judul langkah ${number}`}
            value={block.props.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={(e) => {
              // Enter in a title is the fastest way to add the next number:
              // insert after this step and move straight into the new title.
              if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
              e.preventDefault();
              handleInsertAfter(true);
            }}
            placeholder="Judul langkah"
            className="beacon-step-title w-full min-w-0 flex-1 bg-transparent font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground"
          />
        )}
      </div>
    </div>
  );
}

function StepperBlockRender({ block, editor }: StepperRenderProps) {
  const readOnly = !editor.isEditable;
  // `block` goes stale when steps are removed from the node view elsewhere,
  // so whether the stepper is empty has to come from the live document.
  const hasSteps = useEditorState({
    editor: editor as AnyBlockNoteEditor,
    selector: () => ((editor as AnyBlockNoteEditor).getBlock(block.id)?.children ?? []).some((child: { type: string }) => child.type === "step"),
  });

  if (readOnly || hasSteps) return null;

  return (
    <button
      type="button"
      aria-label="Tambah langkah"
      title="Tambah langkah"
      onClick={() => (editor as AnyBlockNoteEditor).updateBlock(block.id, { children: [newStep()] })}
      className="flex size-[var(--step-rail)] items-center justify-center rounded-full border border-border bg-secondary text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Plus className="size-3.5" />
    </button>
  );
}

export const stepBlockSpec = createReactBlockSpec(stepBlockConfig, {
  render: StepBlockRender,
})();

export const stepperBlockSpec = createReactBlockSpec(stepperBlockConfig, {
  render: StepperBlockRender,
})();
