"use client";

import { useCallback, useEffect, useRef, type ClipboardEvent } from "react";
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
import { useUploadScreenshot } from "@/hooks/use-screenshot-blocks";
import { contentFingerprint } from "@/lib/content-fingerprint";
import { getImageFilesFromClipboard } from "@/lib/clipboard-image";
import { readImageDimensions } from "@/lib/image-dimensions";
import { screenshotUploadErrorMessage } from "@/lib/s3/upload-error";
import { useVersionSnapshots } from "@/hooks/use-versions";
import { useIsVersionPreviewing } from "@/lib/version-preview-store";
import { PageIdProvider } from "./page-id-context";
import { AnnotationFocusMode } from "./annotation-focus-mode";
import { CommentSideMenu } from "./comment-side-menu";
import { CommentedBlockCues } from "./commented-block-cues";
import { normalizePageContent } from "@/lib/legacy-lexical-content";
import { toast } from "sonner";
import type { Page, PageContent } from "@/lib/types";

const dictionary = {
  ...en,
  // Indent/outdent tooltips (Bahasa Indonesia for the authoring UI — BlockNote
  // ships no "id" locale). The secondary shortcuts stay exactly what the
  // keymap does: Tab indents, Shift+Tab outdents.
  formatting_toolbar: {
    ...en.formatting_toolbar,
    nest: {
      ...en.formatting_toolbar.nest,
      tooltip: "Tambah indentasi",
      secondary_tooltip: "Tab",
    },
    unnest: {
      ...en.formatting_toolbar.unnest,
      tooltip: "Kurangi indentasi",
      secondary_tooltip: "Shift+Tab",
    },
  },
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
    // Tab indents the current row, but never at the cost of keyboard
    // navigation: while a toolbar/suggestion menu is open, Tab and Shift+Tab
    // are handed back to it (BlockNote's default "prefer-navigate-ui") so the
    // user can still tab between editor UI elements. Setting it explicitly
    // guards the hierarchy behaviour from silently changing with a default.
    tabBehavior: "prefer-navigate-ui",
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

  // Pasted screenshots go through the same presign → S3 → screenshot_blocks
  // pipeline as the "Tangkapan Layar" block's upload prompt. Keeping the hook
  // in a ref lets the stable paste callback always call the latest instance
  // without rebuilding the editor.
  const uploadScreenshot = useUploadScreenshot();
  const uploadScreenshotRef = useRef(uploadScreenshot);
  useEffect(() => {
    uploadScreenshotRef.current = uploadScreenshot;
  }, [uploadScreenshot]);

  const insertScreenshotBlock = useCallback(
    (screenshotBlockId: string, referenceBlockId: string | null) => {
      // The anchor the user's cursor was in when they pasted. Uploading is
      // async, so by the time it finishes that block may have been deleted —
      // fall back to the end of the document rather than dropping the image.
      const reference = referenceBlockId ? editor.getBlock(referenceBlockId) : undefined;
      const anchor = reference ?? editor.document[editor.document.length - 1];
      if (!anchor) return null;

      const [inserted] = editor.insertBlocks(
        [{ type: "screenshot", props: { screenshotBlockId } }],
        anchor,
        "after",
      );
      return inserted ?? null;
    },
    [editor],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      // The upload prompt handles its own paste; intercepting here would
      // upload the same clipboard image twice.
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-screenshot-dropzone]")) return;

      // Read-only Viewers, and the locked version-preview state, must not
      // accept a paste that would only be rejected by RLS anyway.
      if (!editable || isPreviewingRef.current) return;

      const files = getImageFilesFromClipboard(event.clipboardData);
      if (files.length === 0) return;

      // Stop BlockNote's default handler from also inserting the raw image
      // (or a base64 copy) — the screenshot block is the single source of
      // truth for images on a Page (PRD.md §5.2).
      event.preventDefault();
      event.stopPropagation();

      let anchorId: string | null = null;
      try {
        anchorId = editor.getTextCursorPosition().block.id;
      } catch {
        anchorId = editor.document[editor.document.length - 1]?.id ?? null;
      }

      void (async () => {
        let anchor = anchorId;
        for (const file of files) {
          const toastId = toast.loading("Mengunggah gambar…");
          const objectUrl = URL.createObjectURL(file);
          try {
            const { width, height } = await readImageDimensions(objectUrl);
            const screenshotBlock = await uploadScreenshotRef.current({
              pageId: page.id,
              order: 0,
              file,
              width,
              height,
            });
            const inserted = insertScreenshotBlock(screenshotBlock.id, anchor);
            if (inserted) anchor = inserted.id;
            toast.success("Gambar ditambahkan.", { id: toastId });
          } catch (error) {
            toast.error(screenshotUploadErrorMessage(error), { id: toastId });
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        }
      })();
    },
    [editor, editable, insertScreenshotBlock, page.id],
  );

  return (
    <PageIdProvider pageId={page.id}>
      <BlockNoteView
        editor={editor}
        editable={editable && !isPreviewingVersion}
        onChange={handleChange}
        formattingToolbar={false}
        linkToolbar={false}
        slashMenu={false}
        sideMenu={false}
        theme="dark"
        className="min-h-[60vh]"
        onPasteCapture={handlePaste}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => filterSuggestionItems(getSlashMenuItems(editor), query) as DefaultReactSuggestionItem[]}
        />
        <EditorFormattingToolbar />
        <LinkToolbarController />
        <CommentSideMenu />
      </BlockNoteView>
      <CommentedBlockCues page={page} />
      <AnnotationFocusMode />
    </PageIdProvider>
  );
}
