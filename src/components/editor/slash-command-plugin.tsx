"use client";

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { INSERT_CHECK_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import { $createCodeNode } from "@lexical/code";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import { $getSelection, $isRangeSelection } from "lexical";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { $createDividerNode } from "./divider-node";
import { $createScreenshotNode } from "./screenshot-node";

class BlockOption extends MenuOption {
  title: string;
  description: string;
  blockIcon: typeof Heading1;
  isSignature?: boolean;
  onSelect: () => void;

  constructor(props: { key: string; title: string; description: string; icon: typeof Heading1; isSignature?: boolean; onSelect: () => void }) {
    super(props.key);
    this.title = props.title;
    this.description = props.description;
    this.blockIcon = props.icon;
    this.isSignature = props.isSignature;
    this.onSelect = props.onSelect;
  }
}

function insertBlock(editor: ReturnType<typeof useLexicalComposerContext>[0], factory: () => import("lexical").LexicalNode) {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const node = factory();
    selection.insertNodes([node]);
  });
}

export function SlashCommandPlugin() {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);

  const checkTrigger = useBasicTypeaheadTriggerMatch("/", { minLength: 0 });

  const allOptions = useMemo<BlockOption[]>(
    () => [
      new BlockOption({
        key: "screenshot",
        title: "Tangkapan Layar",
        description: "Unggah dan beri anotasi pada gambar",
        icon: ImageIcon,
        isSignature: true,
        onSelect: () => insertBlock(editor, () => $createScreenshotNode("")),
      }),
      new BlockOption({
        key: "h1",
        title: "Judul 1",
        description: "Judul bagian besar",
        icon: Heading1,
        onSelect: () => insertBlock(editor, () => $createHeadingNode("h1")),
      }),
      new BlockOption({
        key: "h2",
        title: "Judul 2",
        description: "Judul bagian sedang",
        icon: Heading2,
        onSelect: () => insertBlock(editor, () => $createHeadingNode("h2")),
      }),
      new BlockOption({
        key: "h3",
        title: "Judul 3",
        description: "Judul bagian kecil",
        icon: Heading3,
        onSelect: () => insertBlock(editor, () => $createHeadingNode("h3")),
      }),
      new BlockOption({
        key: "bullet",
        title: "Daftar Berpoin",
        description: "Buat daftar bertitik",
        icon: List,
        onSelect: () => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
      }),
      new BlockOption({
        key: "numbered",
        title: "Daftar Bernomor",
        description: "Buat daftar berurutan",
        icon: ListOrdered,
        onSelect: () => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
      }),
      new BlockOption({
        key: "checklist",
        title: "Checklist",
        description: "Buat daftar centang",
        icon: ListChecks,
        onSelect: () => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined),
      }),
      new BlockOption({
        key: "code",
        title: "Kode",
        description: "Blok kode dengan spasi tetap",
        icon: Code2,
        onSelect: () => insertBlock(editor, () => $createCodeNode()),
      }),
      new BlockOption({
        key: "quote",
        title: "Kutipan",
        description: "Sorot sebuah kutipan",
        icon: Quote,
        onSelect: () => insertBlock(editor, () => $createQuoteNode()),
      }),
      new BlockOption({
        key: "table",
        title: "Tabel",
        description: "Sisipkan tabel 2×2",
        icon: Table,
        onSelect: () => editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns: "2", rows: "2" }),
      }),
      new BlockOption({
        key: "divider",
        title: "Pembatas",
        description: "Garis pemisah bagian",
        icon: Minus,
        onSelect: () => insertBlock(editor, () => $createDividerNode()),
      }),
    ],
    [editor],
  );

  const options = useMemo(() => {
    if (!query) return allOptions;
    const lower = query.toLowerCase();
    return allOptions.filter((o) => o.title.toLowerCase().includes(lower) || o.description.toLowerCase().includes(lower));
  }, [allOptions, query]);

  const onSelectOption = useCallback(
    (option: BlockOption, nodeToRemove: import("lexical").TextNode | null, closeMenu: () => void) => {
      editor.update(() => {
        nodeToRemove?.remove();
      });
      option.onSelect();
      closeMenu();
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<BlockOption>
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      triggerFn={checkTrigger}
      options={options}
      menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) => {
        if (!anchorElementRef.current || options.length === 0) return null;
        return createPortal(
          <div className="z-50 max-h-80 w-72 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-[0_8px_24px_-8px_oklch(0.06_0.02_250_/_0.6)]">
            {options.map((option, i) => (
              <button
                key={option.key}
                type="button"
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-sm px-2 py-2 text-left",
                  i === selectedIndex && "relative bg-accent before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-primary",
                )}
                onMouseEnter={() => setHighlightedIndex(i)}
                onClick={() => selectOptionAndCleanUp(option)}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-sm",
                    option.isSignature ? "bg-primary-muted text-primary-muted-foreground" : "bg-muted text-foreground",
                  )}
                >
                  <option.blockIcon className="size-3.5" />
                </span>
                <span className="flex flex-col">
                  <span className="text-body-sm text-foreground">{option.title}</span>
                  <span className="text-caption text-muted-foreground">{option.description}</span>
                </span>
              </button>
            ))}
          </div>,
          anchorElementRef.current,
        );
      }}
    />
  );
}
