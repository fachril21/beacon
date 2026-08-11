"use client";

import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { editorSchema } from "@/components/editor/schema";
import { PageIdProvider } from "@/components/editor/page-id-context";
import { normalizePageContent } from "@/lib/legacy-lexical-content";
import type { PageContent } from "@/lib/types";

/** Read-only render of a Page's BlockNote content — same schema/blocks as the editor, edit affordances stripped via editable=false (PRD.md Flow 3 step 6 / Flow 5). */
export function PublicPageContent({ pageId, content }: { pageId: string; content: PageContent }) {
  const editor = useCreateBlockNote({
    schema: editorSchema,
    // Published snapshots taken before the BlockNote migration still hold
    // Lexical JSON — normalize the same way PageEditor does.
    initialContent: normalizePageContent(content),
  });

  return (
    <PageIdProvider pageId={pageId}>
      <BlockNoteView editor={editor} editable={false} theme="dark" className="beacon-reading" formattingToolbar={false} slashMenu={false} sideMenu={false} />
    </PageIdProvider>
  );
}
