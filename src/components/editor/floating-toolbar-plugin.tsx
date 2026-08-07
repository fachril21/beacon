"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  $createParagraphNode,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_LOW,
} from "lexical";
import { mergeRegister } from "@lexical/utils";
import { $setBlocksType } from "@lexical/selection";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { $isCodeNode } from "@lexical/code";
import { TOGGLE_LINK_COMMAND } from "@lexical/link";
import { Bold, Italic, Underline, Strikethrough, Code, Heading1, Heading2, Quote, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { $getSelectedLinkNode } from "./link-utils";

const MARK_BUTTONS = [
  { format: "bold" as const, icon: Bold, label: "Tebal" },
  { format: "italic" as const, icon: Italic, label: "Miring" },
  { format: "underline" as const, icon: Underline, label: "Garis bawah" },
  { format: "strikethrough" as const, icon: Strikethrough, label: "Coret" },
  { format: "code" as const, icon: Code, label: "Kode inline" },
];

/**
 * Follows lexical-playground's FloatingTextFormatToolbarPlugin pattern:
 * visibility/formatting state is derived from the Lexical model via
 * registerUpdateListener + SELECTION_CHANGE_COMMAND (not a raw DOM
 * "selectionchange" listener, which only reflects native browser selection
 * and misses programmatic/command-driven selection changes). The toolbar
 * defers to the code-block exclusion (code has its own formatting model)
 * and to FloatingLinkEditorPlugin when the selection is on a link, so the
 * two floating UIs never overlap.
 */
export function FloatingToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || selection.isCollapsed()) {
      setIsVisible(false);
      return;
    }

    const anchorNode = selection.anchor.getNode();
    const codeAncestor = $isCodeNode(anchorNode) ? anchorNode : anchorNode.getParent();
    if (codeAncestor && $isCodeNode(codeAncestor)) {
      setIsVisible(false);
      return;
    }

    if ($getSelectedLinkNode(selection)) {
      setIsVisible(false);
      return;
    }

    // The Lexical model selection above is the source of truth for whether
    // to show the toolbar at all; the native DOM selection is only used
    // (best-effort) to position it, since a real browser selection always
    // exists whenever the model has a non-collapsed RangeSelection.
    const domSelection = window.getSelection();
    if (domSelection && domSelection.rangeCount > 0) {
      const rect = domSelection.getRangeAt(0).getBoundingClientRect();
      setCoords({ top: rect.top + window.scrollY - 48, left: rect.left + window.scrollX + rect.width / 2 });
    }

    const formats = new Set<string>();
    (["bold", "italic", "underline", "strikethrough", "code"] as const).forEach((f) => {
      if (selection.hasFormat(f)) formats.add(f);
    });
    setActiveFormats(formats);
    setIsVisible(true);
  }, []);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => updateToolbar());
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, updateToolbar]);

  useEffect(() => {
    if (!isVisible) return;
    const reposition = () => editor.getEditorState().read(() => updateToolbar());
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [isVisible, editor, updateToolbar]);

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
        <button
          type="button"
          aria-label="Tautan"
          className="flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
          }}
        >
          <LinkIcon className="size-4" />
        </button>
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
