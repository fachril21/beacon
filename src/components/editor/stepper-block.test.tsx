import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";
import { editorSchema, type EditorSchema } from "./schema";
import { removeStepBlock } from "./stepper-block";

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

  it("marks only the final step of a group so the connector stops before the next circle", async () => {
    const { container } = render(<TestEditor editable={false} initialContent={twoSteps} />);
    await screen.findByText("Buka pengaturan");

    const markers = Array.from(container.querySelectorAll("[data-last]"));
    expect(markers.map((marker) => marker.getAttribute("data-last"))).toEqual(["false", "true"]);
  });

  it("marks steps inside a nested stepper so the outline recedes a level", async () => {
    const nested: EditorContent = [
      {
        type: "stepper",
        children: [
          {
            type: "step",
            props: { title: "Langkah luar" },
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
        ],
      },
    ];
    const { container } = render(<TestEditor editable={false} initialContent={nested} />);
    await waitFor(() => expect(screen.getAllByLabelText("Langkah 1")).toHaveLength(2));

    const markers = Array.from(container.querySelectorAll("[data-nested]"));
    expect(markers.map((marker) => marker.getAttribute("data-nested"))).toEqual(["false", "true", "true"]);
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

  it("uses a generic 'Judul langkah' placeholder instead of numbering the placeholder text", async () => {
    const untitled: EditorContent = [{ type: "stepper", children: [{ type: "step" }] }];
    render(<TestEditor editable={true} initialContent={untitled} />);
    expect(await screen.findByPlaceholderText("Judul langkah")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Langkah \d/)).not.toBeInTheDocument();
  });

  it("adds the next numbered step from the + below the last number, as many times as needed", async () => {
    const user = userEvent.setup();
    render(<TestEditor editable={true} initialContent={twoSteps} />);
    // There is no separate text button; the only add-next control is the "+".
    expect(screen.queryByRole("button", { name: "Tambah langkah" })).not.toBeInTheDocument();

    await user.click(await screen.findByLabelText("Tambah langkah setelah langkah 2"));
    await waitFor(() => expect(screen.getByLabelText("Langkah 3")).toBeInTheDocument());

    await user.click(await screen.findByLabelText("Tambah langkah setelah langkah 3"));
    await waitFor(() => expect(screen.getByLabelText("Langkah 4")).toBeInTheDocument());
    expect(screen.getAllByLabelText(/^Langkah \d$/)).toHaveLength(4);
  });

  it("adds the next step when Enter is pressed in a title", async () => {
    const user = userEvent.setup();
    render(<TestEditor editable={true} initialContent={twoSteps} />);
    const firstTitle = await screen.findByLabelText("Judul langkah 1");
    firstTitle.focus();
    await user.keyboard("{Enter}");

    const secondTitle = await screen.findByLabelText("Judul langkah 2");
    await waitFor(() => expect(secondTitle).toHaveFocus());
    // The following step's number shifts to 3 because the new step became 2.
    expect(screen.getByLabelText("Langkah 3")).toBeInTheDocument();
  });

  it("renders no per-step trash button — deletion lives in the six-dot menu", async () => {
    render(<TestEditor editable={true} initialContent={twoSteps} />);
    await screen.findByLabelText("Langkah 1");
    expect(screen.queryByLabelText(/Hapus langkah/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Hapus langkah/ })).not.toBeInTheDocument();
  });

  it("renders static text with no edit affordances for a read-only Viewer", async () => {
    render(<TestEditor editable={false} initialContent={twoSteps} />);
    expect(await screen.findByText("Buka pengaturan")).toBeInTheDocument();
    expect(screen.getByText("Masuk ke menu pengaturan akun.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Judul langkah/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Tambah langkah/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Hapus langkah/)).not.toBeInTheDocument();
  });

  it("falls back to a generic 'Judul langkah' title in read-only mode when a step has no title", async () => {
    const untitled: EditorContent = [{ type: "stepper", children: [{ type: "step" }] }];
    render(<TestEditor editable={false} initialContent={untitled} />);
    expect(await screen.findByText("Judul langkah")).toBeInTheDocument();
    expect(screen.queryByText("Langkah 1")).not.toBeInTheDocument();
  });

  it("shows a recovery add-step affordance when a stepper has been emptied of all steps", async () => {
    const user = userEvent.setup();
    const empty: EditorContent = [{ type: "stepper", children: [] }];
    render(<TestEditor editable={true} initialContent={empty} />);
    const recover = await screen.findByRole("button", { name: "Tambah langkah" });
    await user.click(recover);
    expect(await screen.findByLabelText("Langkah 1")).toBeInTheDocument();

    // Once the empty control seeds the first step, the per-step "+" takes over.
    await user.click(await screen.findByLabelText("Tambah langkah setelah langkah 1"));
    await waitFor(() => expect(screen.getByLabelText("Langkah 2")).toBeInTheDocument());
  });

  it("renders nothing for an empty stepper in read-only mode", () => {
    const empty: EditorContent = [{ type: "stepper", children: [] }];
    render(<TestEditor editable={false} initialContent={empty} />);
    expect(screen.queryByRole("button", { name: "Tambah langkah" })).not.toBeInTheDocument();
  });
});

/**
 * The insert-after handlers are one-line calls to `editor.insertBlocks(...)`.
 * The React tests above cover the rendered controls; these headless tests
 * assert the block tree itself — same stepper, correct sibling order, and a
 * paragraph body seeded for the cursor — without depending on node-view
 * mount timing.
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

  it("appends after the last step, so the persistent add control keeps counting upward", () => {
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
    const secondStepId = editor.document[0].children[1].id;

    editor.insertBlocks([{ type: "step", children: [{ type: "paragraph" }] }], secondStepId, "after");

    const steps = editor.document[0].children;
    expect(steps).toHaveLength(3);
    expect(steps.map((step) => step.type)).toEqual(["step", "step", "step"]);
    expect((steps[2].props as { title: string }).title).toBe("");
    expect(steps[2].children[0].type).toBe("paragraph");
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

/**
 * The drag-handle menu calls `removeStepBlock` (the same helper both UI paths
 * use). These headless tests pin the rule that matters for the UX: a step's
 * sibling deletion keeps the list, while deleting the last step takes the
 * whole now-empty container with it.
 */
describe("step removal via the six-dot menu (headless)", () => {
  it("removes only the chosen step while siblings remain", () => {
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
    const [first, second] = editor.document[0].children;

    removeStepBlock(editor, first.id);

    expect(editor.document).toHaveLength(1);
    expect(editor.document[0].type).toBe("stepper");
    expect(editor.document[0].children.map((child) => child.id)).toEqual([second.id]);
    expect((editor.document[0].children[0].props as { title: string }).title).toBe("Langkah kedua");
  });

  it("removes the whole stepper when its last remaining step is deleted", () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [
        { type: "paragraph", content: "Sebelum" },
        { type: "stepper", children: [{ type: "step", props: { title: "Satu-satunya langkah" } }] },
        { type: "paragraph", content: "Sesudah" },
      ],
    });
    const stepId = editor.document[1].children[0].id;

    removeStepBlock(editor, stepId);

    expect(editor.document.map((block) => block.type)).toEqual(["paragraph", "paragraph"]);
    expect(editor.document.map((block) => block.id)).not.toContain(stepId);
  });

  it("removes only an inner stepper when a nested stepper loses its last step", () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [
        {
          type: "stepper",
          children: [
            {
              type: "step",
              props: { title: "Langkah luar" },
              children: [
                {
                  type: "stepper",
                  children: [{ type: "step", props: { title: "Langkah dalam" } }],
                },
              ],
            },
          ],
        },
      ],
    });
    const innerStepId = editor.document[0].children[0].children[0].children[0].id;

    removeStepBlock(editor, innerStepId);

    const outerStep = editor.document[0].children[0];
    expect(outerStep.type).toBe("step");
    expect(outerStep.children).toHaveLength(0);
  });

  it("removes a step that has no stepper parent without touching its neighbours", () => {
    const editor = BlockNoteEditor.create({
      schema: editorSchema,
      initialContent: [
        { type: "step", props: { title: "Lepas" } },
        { type: "paragraph", content: "Tetap ada" },
      ],
    });
    const stepId = editor.document[0].id;

    removeStepBlock(editor, stepId);

    expect(editor.document.map((block) => block.type)).toEqual(["paragraph"]);
  });
});
