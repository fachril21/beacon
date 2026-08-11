import { describe, it, expect } from "vitest";
import { BlockNoteEditor } from "@blocknote/core";
import { editorSchema } from "./schema";
import { getSlashMenuItems } from "./slash-menu-items";

function createTestEditor() {
  return BlockNoteEditor.create({ schema: editorSchema, initialContent: [{ type: "paragraph", content: "" }] });
}

describe("getSlashMenuItems", () => {
  it("pins the Tangkapan Layar (screenshot) item first, ahead of every standard block type", () => {
    const editor = createTestEditor();
    const items = getSlashMenuItems(editor);

    expect(items[0].title).toBe("Tangkapan Layar");
    expect(items.map((i) => i.title)).toEqual([
      "Tangkapan Layar",
      "Judul 1",
      "Judul 2",
      "Judul 3",
      "Daftar Berpoin",
      "Daftar Bernomor",
      "Checklist",
      "Kode",
      "Kutipan",
      "Tabel",
      "Pembatas",
      "Stepper",
    ]);
  });

  it("inserting the screenshot item adds a screenshot block with an empty screenshotBlockId", () => {
    const editor = createTestEditor();
    editor.setTextCursorPosition(editor.document[0], "start");
    const items = getSlashMenuItems(editor);

    items.find((i) => i.title === "Tangkapan Layar")!.onItemClick();

    expect(editor.document[0]).toMatchObject({ type: "screenshot", props: { screenshotBlockId: "" } });
  });

  it("inserting Judul 1 converts the current empty block into a level-1 heading", () => {
    const editor = createTestEditor();
    editor.setTextCursorPosition(editor.document[0], "start");
    const items = getSlashMenuItems(editor);

    items.find((i) => i.title === "Judul 1")!.onItemClick();

    expect(editor.document[0]).toMatchObject({ type: "heading", props: { level: 1 } });
  });

  it("inserting Tabel adds a 2x2 table", () => {
    const editor = createTestEditor();
    editor.setTextCursorPosition(editor.document[0], "start");
    const items = getSlashMenuItems(editor);

    items.find((i) => i.title === "Tabel")!.onItemClick();

    const tableBlock = editor.document[0] as unknown as { type: string; content: { rows: { cells: unknown[] }[] } };
    expect(tableBlock.type).toBe("table");
    expect(tableBlock.content.rows).toHaveLength(2);
    expect(tableBlock.content.rows[0].cells).toHaveLength(2);
  });

  it("inserting Stepper creates a stepper block seeded with two step children, each with an empty paragraph body", () => {
    const editor = createTestEditor();
    editor.setTextCursorPosition(editor.document[0], "start");
    const items = getSlashMenuItems(editor);

    items.find((i) => i.title === "Stepper")!.onItemClick();

    const stepper = editor.document[0];
    expect(stepper.type).toBe("stepper");
    expect(stepper.children).toHaveLength(2);
    expect(stepper.children.every((child) => child.type === "step")).toBe(true);
    // Each step body starts with an empty paragraph — a cursor target the user can
    // immediately type into or press "/" from, matching GitBook's "Step content" placeholder line.
    expect(stepper.children.every((child) => child.children.length === 1 && child.children[0].type === "paragraph")).toBe(true);
  });
});
