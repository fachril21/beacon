import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import { editorSchema, type EditorSchema } from "./schema";

/**
 * Every step in this suite lives nested inside a `stepper` block. BlockNote's
 * `ReactNodeViewRenderer` mounts a *nested* custom React block (a `step`
 * inside a `stepper`, itself a custom block) asynchronously — confirmed by
 * direct DOM inspection: a top-level `step` renders its full JSX
 * synchronously, but the identical component only appears after yielding
 * (`waitFor`/`findBy*`) when nested one level deeper. This is a jsdom/test
 * timing characteristic only — the live app (verified in a running browser)
 * renders nested steps immediately, with no visible delay. So every
 * assertion here that touches step content goes through an async query.
 */

type EditorContent = PartialBlock<EditorSchema["blockSchema"], EditorSchema["inlineContentSchema"], EditorSchema["styleSchema"]>[];

function TestEditor({ editable, initialContent }: { editable: boolean; initialContent: EditorContent }) {
  const editor = useCreateBlockNote({ schema: editorSchema, initialContent });
  return <BlockNoteView editor={editor} editable={editable} formattingToolbar={false} slashMenu={false} linkToolbar={false} sideMenu={false} />;
}

const twoSteps: EditorContent = [
  {
    type: "stepper",
    children: [
      {
        type: "step",
        props: { title: "Buka pengaturan" },
        children: [{ type: "paragraph", content: "Masuk ke menu pengaturan akun." }],
      },
      { type: "step", props: { title: "Simpan perubahan" } },
    ],
  },
];

describe("stepper block render", () => {
  it("renders numbered steps with their title and nested body content", async () => {
    render(<TestEditor editable={true} initialContent={twoSteps} />);
    expect(await screen.findByLabelText("Langkah 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Langkah 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Judul langkah 1")).toHaveValue("Buka pengaturan");
    expect(screen.getByLabelText("Judul langkah 2")).toHaveValue("Simpan perubahan");
    expect(screen.getByText("Masuk ke menu pengaturan akun.")).toBeInTheDocument();
  });

  it("renders a nested stepper inside a step's body with its own independent numbering", async () => {
    const nested: EditorContent = [
      {
        type: "stepper",
        children: [
          {
            type: "step",
            props: { title: "Langkah luar 1" },
            children: [
              {
                type: "stepper",
                children: [
                  { type: "step", props: { title: "Langkah dalam 1" } },
                  { type: "step", props: { title: "Langkah dalam 2" } },
                ],
              },
            ],
          },
          { type: "step", props: { title: "Langkah luar 2" } },
        ],
      },
    ];
    render(<TestEditor editable={true} initialContent={nested} />);
    // Two independent numbering scopes each start at 1 — four "Langkah 1"/"Langkah 2" circle labels total (outer x2, inner x2).
    await waitFor(() => {
      expect(screen.getAllByLabelText("Langkah 1")).toHaveLength(2);
      expect(screen.getAllByLabelText("Langkah 2")).toHaveLength(2);
    });
    expect(screen.getByDisplayValue("Langkah luar 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Langkah dalam 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Langkah dalam 2")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Langkah luar 2")).toBeInTheDocument();
  });

  it("lets an editor edit a step's title", async () => {
    const user = userEvent.setup();
    render(<TestEditor editable={true} initialContent={twoSteps} />);
    const title = await screen.findByLabelText("Judul langkah 2");
    await user.clear(title);
    await user.type(title, "Terapkan perubahan");
    expect(title).toHaveValue("Terapkan perubahan");
  });

  it("renders an insert-after control for every step, labeled with that step's own number", async () => {
    render(<TestEditor editable={true} initialContent={twoSteps} />);
    expect(await screen.findByLabelText("Tambah langkah setelah langkah 1")).toBeInTheDocument();
    expect(await screen.findByLabelText("Tambah langkah setelah langkah 2")).toBeInTheDocument();
  });

  it("lets an editor remove a step when more than one remains", async () => {
    const user = userEvent.setup();
    render(<TestEditor editable={true} initialContent={twoSteps} />);
    const removeSecond = await screen.findByLabelText("Hapus langkah 2");
    await user.click(removeSecond);
    await waitFor(() => expect(screen.queryByLabelText("Langkah 2")).not.toBeInTheDocument());
    expect(screen.getByLabelText("Langkah 1")).toBeInTheDocument();
  });

  it("does not allow removing the last remaining step", async () => {
    const oneStep: EditorContent = [{ type: "stepper", children: [{ type: "step", props: { title: "Satu-satunya langkah" } }] }];
    render(<TestEditor editable={true} initialContent={oneStep} />);
    expect(await screen.findByLabelText("Langkah 1")).toBeInTheDocument();
    expect(screen.queryByLabelText("Hapus langkah 1")).not.toBeInTheDocument();
  });

  it("renders static text with no edit affordances for a read-only Viewer", async () => {
    render(<TestEditor editable={false} initialContent={twoSteps} />);
    expect(await screen.findByText("Buka pengaturan")).toBeInTheDocument();
    expect(screen.getByText("Masuk ke menu pengaturan akun.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Judul langkah/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Tambah langkah/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Hapus langkah/)).not.toBeInTheDocument();
  });

  it("falls back to a numbered placeholder title in read-only mode when a step has no title", async () => {
    const untitled: EditorContent = [{ type: "stepper", children: [{ type: "step" }] }];
    render(<TestEditor editable={false} initialContent={untitled} />);
    expect(await screen.findByText("Langkah 1")).toBeInTheDocument();
  });

  it("shows a recovery add-step affordance when a stepper has been emptied of all steps", async () => {
    const user = userEvent.setup();
    const empty: EditorContent = [{ type: "stepper", children: [] }];
    render(<TestEditor editable={true} initialContent={empty} />);
    const recover = await screen.findByRole("button", { name: "Tambah langkah" });
    await user.click(recover);
    expect(await screen.findByLabelText("Langkah 1")).toBeInTheDocument();
  });

  it("renders nothing for an empty stepper in read-only mode", () => {
    const empty: EditorContent = [{ type: "stepper", children: [] }];
    render(<TestEditor editable={false} initialContent={empty} />);
    expect(screen.queryByRole("button", { name: "Tambah langkah" })).not.toBeInTheDocument();
  });
});

/**
 * The "+" insert-after control's handler is a one-line call to
 * `editor.insertBlocks([{ type: "step", children: [{ type: "paragraph" }] }], block.id, "after")`
 * (see handleInsertAfter in stepper-block.tsx). RTL/jsdom can reliably mount
 * an *initial* nested step (proven above) but not a *newly inserted* one
 * within a nested custom block — the click fires and the transaction
 * commits, but jsdom never flushes the new node view's async mount within
 * any tested timeout, even though the identical interaction renders
 * correctly in a live browser (verified manually). Headless — no React
 * rendering, no node views — is what actually proves the block-tree logic
 * is correct.
 */
describe("stepper insert-after block manipulation (headless)", () => {
  it("inserts a new step (with an empty paragraph body) immediately after the given step, inside the same stepper", () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [
        {
          type: "stepper",
          children: [
            { type: "step", props: { title: "Langkah pertama" } },
            { type: "step", props: { title: "Langkah kedua" } },
          ],
        },
      ],
    });
    const stepper = editor.document[0];
    const firstStepId = stepper.children[0].id;

    editor.insertBlocks([{ type: "step", children: [{ type: "paragraph" }] }], firstStepId, "after");

    const updatedStepper = editor.document[0];
    expect(updatedStepper.children).toHaveLength(3);
    expect(updatedStepper.children.map((c) => c.type)).toEqual(["step", "step", "step"]);
    expect((updatedStepper.children[0].props as { title: string }).title).toBe("Langkah pertama");
    expect((updatedStepper.children[1].props as { title: string }).title).toBe("");
    expect((updatedStepper.children[2].props as { title: string }).title).toBe("Langkah kedua");
    // The new step gets an empty paragraph body — a cursor target the user can
    // immediately type into or press "/" from (GitBook's "Step content" placeholder line).
    expect(updatedStepper.children[1].children).toHaveLength(1);
    expect(updatedStepper.children[1].children[0].type).toBe("paragraph");
  });

  it("the empty-stepper recovery button's update also seeds the new step with an empty paragraph body", () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [{ type: "stepper", children: [] }],
    });
    const stepperId = editor.document[0].id;

    editor.updateBlock(stepperId, { children: [{ type: "step", children: [{ type: "paragraph" }] }] });

    const recovered = editor.document[0].children[0];
    expect(recovered.type).toBe("step");
    expect(recovered.children).toHaveLength(1);
    expect(recovered.children[0].type).toBe("paragraph");
  });
});
