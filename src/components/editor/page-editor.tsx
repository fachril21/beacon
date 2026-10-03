"use client";

import { useCallback, useEffect, useRef } from "react";
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
import { contentFingerprint } from "@/lib/content-fingerprint";
import { useVersionSnapshots } from "@/hooks/use-versions";
import { useIsVersionPreviewing } from "@/lib/version-preview-store";
import { PageIdProvider } from "./page-id-context";
import { AnnotationFocusMode } from "./annotation-focus-mode";
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
  // Locked read-only while a Version History preview is open.
  const isPreviewingVersion = useIsVersionPreviewing(page.id);
  // First history entry = the page as loaded, before any edit (captured once, at mount).
  const snapshotVersion = useVersionSnapshots(page.id, { title: page.title, content: page.content });
  // The title is saved independently of content; read its latest value at snapshot time.
  const titleRef = useRef(page.title);
  useEffect(() => {
    titleRef.current = page.title;
  }, [page.title]);
  const handleSaved = useCallback(
    (content: PageContent) => {
      void snapshotVersion(titleRef.current, content);
    },
    [snapshotVersion],
  );
  const { status, scheduleSave, cancelScheduledSave } = usePageAutosave(page.id, false, handleSaved);
  // The last content known to be saved, to tell real edits from editor noise.
  const savedContentRef = useRef(page.content);
  useEffect(() => {
    savedContentRef.current = page.content;
  }, [page.content]);
  const isPreviewingRef = useRef(isPreviewingVersion);
  useEffect(() => {
    isPreviewingRef.current = isPreviewingVersion;
  }, [isPreviewingVersion]);

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
    // Locking the editor for a version preview must never count as an edit.
    if (isPreviewingRef.current) return;
    // Clicking a new line, or typing text and deleting it again, leaves the
    // document unchanged: save nothing, and drop a save the typing scheduled.
    if (contentFingerprint(editor.document) === contentFingerprint(savedContentRef.current)) {
      cancelScheduledSave();
      return;
    }
    // editor.document is a full Block[]; TS can't always see this satisfies
    // the looser PartialBlock[] shape through BlockNote's deeply generic
    // schema union, though it always does at runtime.
    scheduleSave(editor.document as PageContent);
  }, [editor, scheduleSave, cancelScheduledSave]);

  return (
    <PageIdProvider pageId={page.id}>
      <BlockNoteView
        editor={editor}
        editable={editable && !isPreviewingVersion}
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
      <AnnotationFocusMode />
    </PageIdProvider>
  );
}
