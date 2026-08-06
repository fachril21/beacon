import type { EditorThemeClasses } from "lexical";

/** Maps Lexical node types to Tailwind classes matching DESIGN.md §3.1's type scale. */
export const editorTheme: EditorThemeClasses = {
  paragraph: "text-body text-foreground mb-3 last:mb-0",
  heading: {
    h1: "text-h1 font-bold text-foreground mt-8 mb-3 first:mt-0",
    h2: "text-h2 font-semibold text-foreground mt-10 mb-3 first:mt-0",
    h3: "text-h3 font-semibold text-foreground mt-8 mb-2 first:mt-0",
  },
  quote: "border-l-2 border-border pl-4 text-body text-muted-foreground italic my-4",
  list: {
    ul: "list-disc pl-6 mb-3 flex flex-col gap-1",
    ol: "list-decimal pl-6 mb-3 flex flex-col gap-1",
    listitem: "text-body text-foreground pl-1",
    listitemChecked: "editor-checklist editor-checklist-checked text-body text-muted-foreground line-through",
    listitemUnchecked: "editor-checklist text-body text-foreground",
    checklist: "list-none pl-0 mb-3 flex flex-col gap-1.5",
    nested: {
      listitem: "list-none",
    },
  },
  code: "block rounded-md border border-border bg-card px-4 py-3 font-mono text-mono text-foreground my-4 whitespace-pre overflow-x-auto",
  text: {
    bold: "font-semibold",
    italic: "italic",
    underline: "underline underline-offset-2",
    strikethrough: "line-through",
    code: "font-mono text-mono bg-card border border-border rounded-sm px-1.5 py-0.5",
  },
  link: "text-primary-muted-foreground underline underline-offset-4 hover:text-primary-hover",
  table: "w-full border-collapse my-4 text-body-sm",
  tableCell: "border border-border px-3 py-2 text-left align-top",
  tableCellHeader: "border border-border px-3 py-2 text-left align-top bg-muted font-semibold",
  tableRow: "",
};
