"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_LOW } from "lexical";
import { mergeRegister } from "@lexical/utils";
import { TOGGLE_LINK_COMMAND, formatUrl } from "@lexical/link";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { $getSelectedLinkNode } from "./link-utils";

/** Sentinel URL FloatingToolbarPlugin's Link button dispatches to create an empty link. */
const FRESH_LINK_URL = "https://";

/**
 * Follows lexical-playground's FloatingLinkEditorPlugin pattern: tracks
 * whether the selection sits on a LinkNode via registerUpdateListener +
 * SELECTION_CHANGE_COMMAND, and renders either a view (URL + edit + remove)
 * or an edit (URL input) popover anchored near the link. Freshly created
 * links (still holding the "https://" placeholder from the toolbar's Link
 * button) open directly in edit mode with an empty input, and are removed
 * outright if the user backs out via Escape without typing a URL.
 */
export function FloatingLinkEditorPlugin() {
  const [editor] = useLexicalComposerContext();
  const [isLink, setIsLink] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isNewLink, setIsNewLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [editedUrl, setEditedUrl] = useState("");
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const autoEditedKeyRef = useRef<string | null>(null);

  const updateLinkEditor = useCallback(() => {
    const selection = $getSelection();
    const linkNode = $getSelectedLinkNode(selection);

    if (!linkNode) {
      setIsLink(false);
      return;
    }

    const url = linkNode.getURL();
    setLinkUrl(url);
    setIsLink(true);

    if (url === FRESH_LINK_URL && autoEditedKeyRef.current !== linkNode.getKey()) {
      autoEditedKeyRef.current = linkNode.getKey();
      setIsNewLink(true);
      setEditedUrl("");
      setIsEditMode(true);
    }

    const domSelection = window.getSelection();
    const rect =
      domSelection && domSelection.rangeCount > 0 && !domSelection.isCollapsed
        ? domSelection.getRangeAt(0).getBoundingClientRect()
        : editor.getElementByKey(linkNode.getKey())?.getBoundingClientRect();
    if (rect) {
      setCoords({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX });
    }
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => updateLinkEditor());
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateLinkEditor();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, updateLinkEditor]);

  useEffect(() => {
    if (isEditMode) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditMode]);

  const submitUrl = useCallback(() => {
    const trimmed = editedUrl.trim();
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, trimmed ? formatUrl(trimmed) : null);
    setIsEditMode(false);
    setIsNewLink(false);
  }, [editor, editedUrl]);

  const cancelEdit = useCallback(() => {
    if (isNewLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
    setIsEditMode(false);
    setIsNewLink(false);
  }, [editor, isNewLink]);

  if (!isLink) return null;

  return createPortal(
    <div
      className="fixed z-50 flex items-center gap-1 rounded-md border border-border bg-popover p-1 shadow-[0_8px_24px_-8px_oklch(0.06_0.02_250_/_0.6)]"
      style={{ top: coords.top, left: coords.left }}
    >
      {isEditMode ? (
        <>
          <input
            ref={inputRef}
            aria-label="URL tautan"
            className="h-8 w-56 rounded-sm border border-border bg-background px-2 text-body-sm text-foreground outline-none"
            value={editedUrl}
            placeholder="https://…"
            onChange={(e) => setEditedUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitUrl();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelEdit();
              }
            }}
            onBlur={() => {
              if (isNewLink && !editedUrl.trim()) cancelEdit();
            }}
          />
          <button
            type="button"
            aria-label="Simpan tautan"
            className="flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            onMouseDown={(e) => {
              e.preventDefault();
              submitUrl();
            }}
          >
            <Check className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Batal"
            className="flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            onMouseDown={(e) => {
              e.preventDefault();
              cancelEdit();
            }}
          >
            <X className="size-4" />
          </button>
        </>
      ) : (
        <>
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-56 truncate px-2 text-body-sm text-primary-muted-foreground underline underline-offset-4 hover:text-primary-hover"
          >
            {linkUrl}
          </a>
          <button
            type="button"
            aria-label="Ubah tautan"
            className={cn("flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground")}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsNewLink(false);
              setEditedUrl(linkUrl);
              setIsEditMode(true);
            }}
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Hapus tautan"
            className="flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            onMouseDown={(e) => {
              e.preventDefault();
              editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
            }}
          >
            <Trash2 className="size-4" />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
