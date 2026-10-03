"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { editorSchema } from "./schema";
import { PageIdProvider } from "./page-id-context";
import { normalizePageContent } from "@/lib/legacy-lexical-content";
import type { Version } from "@/lib/types";

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * An old Version rendered in the main editor column, read-only. It is a
 * separate editor from PageEditor on purpose: it has no autosave, no version
 * snapshots and no change handler, so nothing viewed here can ever be written
 * back to the Page.
 */
export function VersionPreview({ version }: { version: Version }) {
  const editor = useCreateBlockNote({
    schema: editorSchema,
    initialContent: normalizePageContent(version.content),
  });

  return (
    <PageIdProvider pageId={version.pageId}>
      <div className="mb-4 rounded-md border border-warning/30 bg-warning-muted px-4 py-2.5 text-caption text-warning-muted-foreground">
        Pratinjau versi — bukan draf yang sedang aktif
        <span className="ml-2 text-muted-foreground">{formatTimestamp(version.createdAt)}</span>
      </div>
      <BlockNoteView
        editor={editor}
        editable={false}
        formattingToolbar={false}
        linkToolbar={false}
        slashMenu={false}
        sideMenu={false}
        theme="dark"
        className="min-h-[60vh]"
      />
    </PageIdProvider>
  );
}
