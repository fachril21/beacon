"use client";

import { useCallback, useEffect, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import type { EditorState } from "lexical";
import { editorTheme } from "./editor-theme";
import { editorNodes } from "./nodes";
import { SlashCommandPlugin } from "./slash-command-plugin";
import { FloatingToolbarPlugin } from "./floating-toolbar-plugin";
import { usePageAutosave, type SaveStatus } from "@/hooks/use-page-autosave";
import { PageIdProvider } from "./page-id-context";
import type { Page } from "@/lib/types";

export function PageEditor({
  page,
  onStatusChange,
  editable = true,
}: {
  page: Page;
  onStatusChange?: (status: SaveStatus) => void;
  /** Viewer-role Users (US17.2) get a read-only editor — RLS already rejects the write. */
  editable?: boolean;
}) {
  const { status, scheduleSave } = usePageAutosave(page.id);

  useEffect(() => {
    onStatusChange?.(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  const [initialConfig] = useState(() => ({
    namespace: `beacon-page-${page.id}`,
    theme: editorTheme,
    nodes: editorNodes,
    editorState: JSON.stringify(page.content),
    editable,
    onError: (error: Error) => {
      console.error("Lexical error:", error);
    },
  }));

  const handleChange = useCallback(
    (editorState: EditorState) => {
      scheduleSave(editorState.toJSON());
    },
    [scheduleSave],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <PageIdProvider pageId={page.id}>
        <div className="relative">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="min-h-[60vh] text-body text-foreground outline-none [&_.editor-checklist-checked_+_br]:hidden"
                aria-placeholder="Mulai menulis, atau ketik “/” untuk menyisipkan blok…"
                placeholder={
                  <div className="pointer-events-none absolute top-0 text-body text-muted-foreground">
                    Mulai menulis, atau ketik “/” untuk menyisipkan blok…
                  </div>
                }
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <CheckListPlugin />
        <TablePlugin />
        <LinkPlugin />
        <TabIndentationPlugin />
        <SlashCommandPlugin />
        <FloatingToolbarPlugin />
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
      </PageIdProvider>
    </LexicalComposer>
  );
}
