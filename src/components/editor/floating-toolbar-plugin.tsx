"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, $createParagraphNode } from "lexical";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { Bold, Italic, Underline, Strikethrough, Code, Heading1, Heading2, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

const MARK_BUTTONS = [
  { format: "bold" as const, icon: Bold, label: "Tebal" },
  { format: "italic" as const, icon: Italic, label: "Miring" },
  { format: "underline" as const, icon: Underline, label: "Garis bawah" },
  { format: "strikethrough" as const, icon: Strikethrough, label: "Coret" },
  { format: "code" as const, icon: Code, label: "Kode inline" },
];

export function FloatingToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const checkSelection = useCallback(() => {
    const rootElement = editor.getRootElement();
    const domSelection = window.getSelection();
    if (
      !rootElement ||
      !domSelection ||
      domSelection.rangeCount === 0 ||
      domSelection.isCollapsed ||
      !rootElement.contains(domSelection.anchorNode)
    ) {
      setIsVisible(false);
      return;
    }
    const range = domSelection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setIsVisible(false);
      return;
    }

    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || selection.isCollapsed()) {
        setIsVisible(false);
        return;
      }
      const formats = new Set<string>();
      (["bold", "italic", "underline", "strikethrough", "code"] as const).forEach((f) => {
        if (selection.hasFormat(f)) formats.add(f);
      });
      setActiveFormats(formats);
      setCoords({ top: rect.top + window.scrollY - 48, left: rect.left + window.scrollX + rect.width / 2 });
      setIsVisible(true);
    });
  }, [editor]);

  useEffect(() => {
    document.addEventListener("selectionchange", checkSelection);
    return () => document.removeEventListener("selectionchange", checkSelection);
  }, [checkSelection]);

  if (!isVisible) return null;

  return createPortal(
    <div
      className="fixed z-50 flex -translate-x-1/2 items-center gap-1 rounded-md border border-border bg-popover p-1 shadow-[0_8px_24px_-8px_oklch(0.06_0.02_250_/_0.6)]"
      style={{ top: coords.top, left: coords.left }}
    >
      <div className="flex items-center gap-1 border-r border-border pr-1">
        {MARK_BUTTONS.map(({ format, icon: Icon, label }) => (
          <button
            key={format}
            type="button"
            aria-label={label}
            className={cn(
              "flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground",
              activeFormats.has(format) && "text-primary",
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
            }}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 pl-1">
        <button
          type="button"
          aria-label="Judul 1"
          className="flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createHeadingNode("h1"));
            });
          }}
        >
          <Heading1 className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Judul 2"
          className="flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createHeadingNode("h2"));
            });
          }}
        >
          <Heading2 className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Kutipan"
          className="flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createQuoteNode());
            });
          }}
        >
          <Quote className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Paragraf"
          className="flex size-8 items-center justify-center rounded-sm text-caption font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.update(() => {
              const selection = $getSelection();
              if ($isRangeSelection(selection)) $setBlocksType(selection, () => $createParagraphNode());
            });
          }}
        >
          P
        </button>
      </div>
    </div>,
    document.body,
  );
}
