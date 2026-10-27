import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import type { PartialBlock } from "@blocknote/core";
import { editorSchema, type EditorSchema } from "./schema";

type EditorContent = PartialBlock<EditorSchema["blockSchema"], EditorSchema["inlineContentSchema"], EditorSchema["styleSchema"]>[];

function TestEditor({ editable, initialContent }: { editable: boolean; initialContent: EditorContent }) {
  const editor = useCreateBlockNote({ schema: editorSchema, initialContent });
  return <BlockNoteView editor={editor} editable={editable} formattingToolbar={false} slashMenu={false} linkToolbar={false} sideMenu={false} />;
}

describe("page builder blocks", () => {
  it("renders a callout's text next to its variant affordance", async () => {
    const content: EditorContent = [
      { type: "callout", props: { variant: "warning" }, content: "Periksa kembali konfigurasi." },
      { type: "paragraph", content: "" },
    ];

    const { container } = render(<TestEditor editable={true} initialContent={content} />);

    expect(await screen.findByText("Periksa kembali konfigurasi.")).toBeInTheDocument();
    expect(screen.getByLabelText("Jenis callout")).toHaveValue("warning");
    expect(container.querySelector('.beacon-callout[data-variant="warning"]')).not.toBeNull();
  });

  it("renders a button's label and URL field while editing", async () => {
    const content: EditorContent = [
      { type: "button", props: { url: "https://example.com", variant: "primary" }, content: "Buka panduan" },
      { type: "paragraph", content: "" },
    ];

    render(<TestEditor editable={true} initialContent={content} />);

    expect(await screen.findByText("Buka panduan")).toBeInTheDocument();
    expect(screen.getByLabelText("URL tombol")).toHaveValue("https://example.com");
  });

  it("renders a button as a real link in read-only mode", async () => {
    const content: EditorContent = [
      { type: "button", props: { url: "https://example.com", variant: "secondary" }, content: "Buka panduan" },
    ];

    render(<TestEditor editable={false} initialContent={content} />);

    const link = await screen.findByRole("link", { name: /buka panduan/i });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders a two-column layout with both column bodies", async () => {
    const content: EditorContent = [
      {
        type: "columns",
        children: [
          { type: "column", children: [{ type: "paragraph", content: "Kiri" }] },
          { type: "column", children: [{ type: "paragraph", content: "Kanan" }] },
        ],
      },
      { type: "paragraph", content: "" },
    ];

    const { container } = render(<TestEditor editable={true} initialContent={content} />);

    expect(await screen.findByText("Kiri")).toBeInTheDocument();
    expect(screen.getByText("Kanan")).toBeInTheDocument();
    expect(container.querySelectorAll('.bn-block-content[data-content-type="column"]')).toHaveLength(2);
    expect(screen.getByText("2 kolom")).toBeInTheDocument();
  });

  it("does not expose the column count or controls to readers", async () => {
    const content: EditorContent = [
      {
        type: "columns",
        children: [
          { type: "column", children: [{ type: "paragraph", content: "Kiri" }] },
          { type: "column", children: [{ type: "paragraph", content: "Kanan" }] },
        ],
      },
    ];

    render(<TestEditor editable={false} initialContent={content} />);

    expect(await screen.findByText("Kiri")).toBeInTheDocument();
    expect(screen.queryByText("2 kolom")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tambah kolom")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Kurangi kolom")).not.toBeInTheDocument();
  });

  it("adds and removes columns from the editor controls", async () => {
    const content: EditorContent = [
      {
        type: "columns",
        children: [
          { type: "column", children: [{ type: "paragraph", content: "Kiri" }] },
          { type: "column", children: [{ type: "paragraph", content: "Kanan" }] },
        ],
      },
    ];

    const { container } = render(<TestEditor editable={true} initialContent={content} />);

    const user = userEvent.setup();
    await user.click(await screen.findByLabelText("Tambah kolom"));
    await waitFor(() => expect(container.querySelectorAll('.bn-block-content[data-content-type="column"]')).toHaveLength(3));
    expect(screen.getByText("3 kolom")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Kurangi kolom"));
    await waitFor(() => expect(container.querySelectorAll('.bn-block-content[data-content-type="column"]')).toHaveLength(2));
  });
});
