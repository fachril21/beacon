import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Code2,
  Quote,
  Table,
  Minus,
  Image as ImageIcon,
  Milestone,
} from "lucide-react";
import {
  insertOrUpdateBlockForSlashMenu,
  type BlockNoteEditor,
  type BlockSchema,
  type InlineContentSchema,
  type PartialBlock,
  type StyleSchema,
} from "@blocknote/core";
import type { DefaultReactSuggestionItem } from "@blocknote/react";

/**
 * Hand-authored Indonesian slash-menu items (PRODUCT.md: Bahasa Indonesia
 * only for the authoring UI — BlockNote ships no "id" locale, so the default
 * items via getDefaultReactSlashMenuItems() would render in English).
 * Mirrors the block set from the prior Lexical slash command menu.
 */
export function getSlashMenuItems<BSchema extends BlockSchema, ISchema extends InlineContentSchema, SSchema extends StyleSchema>(
  editor: BlockNoteEditor<BSchema, ISchema, SSchema>,
): DefaultReactSuggestionItem[] {
  function insert(block: PartialBlock<BSchema, ISchema, SSchema>) {
    insertOrUpdateBlockForSlashMenu(editor, block);
  }

  return [
    {
      title: "Tangkapan Layar",
      subtext: "Unggah dan beri anotasi pada gambar",
      aliases: ["screenshot", "gambar", "image", "tangkapan"],
      group: "Media",
      icon: <ImageIcon className="size-3.5" />,
      onItemClick: () => insert({ type: "screenshot", props: { screenshotBlockId: "" } } as PartialBlock<BSchema, ISchema, SSchema>),
    },
    {
      title: "Judul 1",
      subtext: "Judul bagian besar",
      aliases: ["h1", "judul1", "heading1"],
      group: "Blok dasar",
      icon: <Heading1 className="size-3.5" />,
      onItemClick: () => insert({ type: "heading", props: { level: 1 } } as PartialBlock<BSchema, ISchema, SSchema>),
    },
    {
      title: "Judul 2",
      subtext: "Judul bagian sedang",
      aliases: ["h2", "judul2", "heading2"],
      group: "Blok dasar",
      icon: <Heading2 className="size-3.5" />,
      onItemClick: () => insert({ type: "heading", props: { level: 2 } } as PartialBlock<BSchema, ISchema, SSchema>),
    },
    {
      title: "Judul 3",
      subtext: "Judul bagian kecil",
      aliases: ["h3", "judul3", "heading3"],
      group: "Blok dasar",
      icon: <Heading3 className="size-3.5" />,
      onItemClick: () => insert({ type: "heading", props: { level: 3 } } as PartialBlock<BSchema, ISchema, SSchema>),
    },
    {
      title: "Daftar Berpoin",
      subtext: "Buat daftar bertitik",
      aliases: ["bullet", "daftar", "list"],
      group: "Blok dasar",
      icon: <List className="size-3.5" />,
      onItemClick: () => insert({ type: "bulletListItem" } as PartialBlock<BSchema, ISchema, SSchema>),
    },
    {
      title: "Daftar Bernomor",
      subtext: "Buat daftar berurutan",
      aliases: ["numbered", "nomor"],
      group: "Blok dasar",
      icon: <ListOrdered className="size-3.5" />,
      onItemClick: () => insert({ type: "numberedListItem" } as PartialBlock<BSchema, ISchema, SSchema>),
    },
    {
      title: "Checklist",
      subtext: "Buat daftar centang",
      aliases: ["checklist", "todo", "centang"],
      group: "Blok dasar",
      icon: <ListChecks className="size-3.5" />,
      onItemClick: () => insert({ type: "checkListItem" } as PartialBlock<BSchema, ISchema, SSchema>),
    },
    {
      title: "Kode",
      subtext: "Blok kode dengan spasi tetap",
      aliases: ["code", "kode"],
      group: "Blok dasar",
      icon: <Code2 className="size-3.5" />,
      onItemClick: () => insert({ type: "codeBlock" } as PartialBlock<BSchema, ISchema, SSchema>),
    },
    {
      title: "Kutipan",
      subtext: "Sorot sebuah kutipan",
      aliases: ["quote", "kutipan"],
      group: "Blok dasar",
      icon: <Quote className="size-3.5" />,
      onItemClick: () => insert({ type: "quote" } as PartialBlock<BSchema, ISchema, SSchema>),
    },
    {
      title: "Tabel",
      subtext: "Sisipkan tabel 2×2",
      aliases: ["table", "tabel"],
      group: "Blok dasar",
      icon: <Table className="size-3.5" />,
      onItemClick: () =>
        insert({
          type: "table",
          content: {
            type: "tableContent",
            rows: [{ cells: [[], []] }, { cells: [[], []] }],
          },
        } as unknown as PartialBlock<BSchema, ISchema, SSchema>),
    },
    {
      title: "Pembatas",
      subtext: "Garis pemisah bagian",
      aliases: ["divider", "pembatas", "hr"],
      group: "Blok dasar",
      icon: <Minus className="size-3.5" />,
      onItemClick: () => insert({ type: "divider" } as PartialBlock<BSchema, ISchema, SSchema>),
    },
    {
      title: "Stepper",
      subtext: "Daftar langkah bernomor yang saling terhubung",
      aliases: ["stepper", "langkah", "steps", "tahapan"],
      group: "Tata letak",
      icon: <Milestone className="size-3.5" />,
      onItemClick: () =>
        insert({
          type: "stepper",
          children: [
            { type: "step", children: [{ type: "paragraph" }] },
            { type: "step", children: [{ type: "paragraph" }] },
          ],
        } as unknown as PartialBlock<BSchema, ISchema, SSchema>),
    },
  ];
}
