"use client";

import { Heading1, Heading2, Quote as QuoteIcon, Pilcrow } from "lucide-react";
import {
  FormattingToolbar,
  FormattingToolbarController,
  BasicTextStyleButton,
  BlockTypeSelect,
  CreateLinkButton,
  type BlockTypeSelectItem,
} from "@blocknote/react";

/** Block-type converters exposed in the floating toolbar (DESIGN.md §6.1) — insert-only types (list/table/divider/screenshot) stay slash-menu-only. */
const blockTypeItems: BlockTypeSelectItem[] = [
  { name: "Paragraf", type: "paragraph", icon: Pilcrow },
  { name: "Judul 1", type: "heading", props: { level: 1 }, icon: Heading1 },
  { name: "Judul 2", type: "heading", props: { level: 2 }, icon: Heading2 },
  { name: "Kutipan", type: "quote", icon: QuoteIcon },
];

function CustomFormattingToolbar() {
  return (
    <FormattingToolbar>
      <BlockTypeSelect items={blockTypeItems} />
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
