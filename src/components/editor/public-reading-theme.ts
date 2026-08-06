import type { EditorThemeClasses } from "lexical";
import { editorTheme } from "./editor-theme";

/** DESIGN.md §3.2 — public reading uses body-lg with generous line-height and 1.25em paragraph spacing. */
export const publicReadingTheme: EditorThemeClasses = {
  ...editorTheme,
  paragraph: "text-body-lg text-foreground mb-5 last:mb-0",
  quote: "border-l-2 border-border pl-4 text-body-lg text-muted-foreground italic my-5",
  list: {
    ...editorTheme.list,
    listitem: "text-body-lg text-foreground pl-1",
    listitemChecked: "editor-checklist editor-checklist-checked text-body-lg text-muted-foreground line-through",
    listitemUnchecked: "editor-checklist text-body-lg text-foreground",
  },
  heading: {
    h1: "text-h1 font-bold text-foreground mt-10 mb-3 first:mt-0",
    h2: "text-h2 font-semibold text-foreground mt-10 mb-3 first:mt-0",
    h3: "text-h3 font-semibold text-foreground mt-8 mb-2 first:mt-0",
  },
  link: "text-primary-muted-foreground underline underline-offset-4 hover:text-primary-hover",
};
