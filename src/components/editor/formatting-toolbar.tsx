"use client";

import { Heading1, Heading2, Heading3, List, ListOrdered, Quote as QuoteIcon, Pilcrow } from "lucide-react";
import {
  FormattingToolbar,
  FormattingToolbarController,
  BasicTextStyleButton,
  BlockTypeSelect,
  CreateLinkButton,
  NestBlockButton,
  UnnestBlockButton,
  type BlockTypeSelectItem,
} from "@blocknote/react";

/**
 * Row-type converters exposed in the floating toolbar (DESIGN.md §6.1) — the
 * full set the hierarchy needs: paragraph, all three heading levels, and both
 * list flavours (GitBook's "turn into" menu), plus quote. Insert-only types
 * (table/divider/screenshot/stepper) stay slash-menu-only, since converting a
 * row into them would discard its text.
 */
export const blockTypeItems: BlockTypeSelectItem[] = [
  { name: "Paragraf", type: "paragraph", icon: Pilcrow },
  { name: "Judul 1", type: "heading", props: { level: 1 }, icon: Heading1 },
  { name: "Judul 2", type: "heading", props: { level: 2 }, icon: Heading2 },
  { name: "Judul 3", type: "heading", props: { level: 3 }, icon: Heading3 },
  { name: "Daftar Berpoin", type: "bulletListItem", icon: List },
  { name: "Daftar Bernomor", type: "numberedListItem", icon: ListOrdered },
  { name: "Kutipan", type: "quote", icon: QuoteIcon },
];

function CustomFormattingToolbar() {
  return (
    <FormattingToolbar>
      <BlockTypeSelect items={blockTypeItems} />
      {/* Indent / outdent — the same hierarchy level Tab and Shift+Tab drive,
          kept here so the affordance is also visible to pointer-only users.
          Each button renders itself only when the current row can actually
          move (`canNestBlock` / `canUnnestBlock`). */}
      <NestBlockButton />
      <UnnestBlockButton />
      <BasicTextStyleButton basicTextStyle="bold" />
      <BasicTextStyleButton basicTextStyle="italic" />
      <BasicTextStyleButton basicTextStyle="underline" />
      <BasicTextStyleButton basicTextStyle="strike" />
      <BasicTextStyleButton basicTextStyle="code" />
      <CreateLinkButton />
    </FormattingToolbar>
  );
}

/** Selection-driven floating toolbar (DESIGN.md §6.1) — replaces the old FloatingToolbarPlugin. */
export function EditorFormattingToolbar() {
  return <FormattingToolbarController formattingToolbar={CustomFormattingToolbar} />;
}
