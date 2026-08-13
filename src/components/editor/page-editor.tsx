"use client";

import { useCallback, useEffect } from "react";
import { filterSuggestionItems } from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import { useCreateBlockNote, SuggestionMenuController, LinkToolbarController, type DefaultReactSuggestionItem } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { editorSchema } from "./schema";
import { getSlashMenuItems } from "./slash-menu-items";
import { EditorFormattingToolbar } from "./formatting-toolbar";
import { codeBlockExitExtension } from "./code-block-exit-extension";
import { trailingParagraphExtension } from "./trailing-paragraph-extension";
import { usePageAutosave, type SaveStatus } from "@/hooks/use-page-autosave";
import { PageIdProvider } from "./page-id-context";
import { normalizePageContent } from "@/lib/legacy-lexical-content";
import type { Page, PageContent } from "@/lib/types";

const dictionary = {
  ...en,
  placeholders: {
    ...en.placeholders,
    default: "Mulai menulis, atau ketik “/” untuk menyisipkan blok…",
    step: "Judul langkah",
  },
};

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

  const editor = useCreateBlockNote({
    schema: editorSchema,
    // Pages saved before the BlockNote migration still hold Lexical JSON —
    // normalizePageContent converts it on the fly so old pages open instead
    // of crashing `initialContent` (any edit then autosaves it forward).
    initialContent: normalizePageContent(page.content),
    extensions: [codeBlockExitExtension, trailingParagraphExtension()],
    dictionary,
  });

  const handleChange = useCallback(() => {
    // editor.document is a full Block[]; TS can't always see this satisfies
    // the looser PartialBlock[] shape through BlockNote's deeply generic
    // schema union, though it always does at runtime.
    scheduleSave(editor.document as PageContent);
  }, [editor, scheduleSave]);

  return (
    <PageIdProvider pageId={page.id}>
      <BlockNoteView
        editor={editor}
        editable={editable}
        onChange={handleChange}
        formattingToolbar={false}
        linkToolbar={false}
        slashMenu={false}
        theme="dark"
        className="min-h-[60vh]"
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => filterSuggestionItems(getSlashMenuItems(editor), query) as DefaultReactSuggestionItem[]}
        />
        <EditorFormattingToolbar />
        <LinkToolbarController />
      </BlockNoteView>
    </PageIdProvider>
  );
}
