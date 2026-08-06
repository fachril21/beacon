"use client";

import { useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import type { SerializedEditorState } from "lexical";
import { publicReadingTheme } from "@/components/editor/public-reading-theme";
import { editorNodes } from "@/components/editor/nodes";
import { PageIdProvider } from "@/components/editor/page-id-context";

/** Read-only render of a Page's Lexical content — same nodes/renderer as the editor, edit affordances stripped via editable:false (PRD.md Flow 3 step 6 / Flow 5). */
export function PublicPageContent({ pageId, content }: { pageId: string; content: SerializedEditorState }) {
  const [initialConfig] = useState(() => ({
    namespace: `beacon-public-${pageId}`,
    theme: publicReadingTheme,
    nodes: editorNodes,
    editable: false,
    editorState: JSON.stringify(content),
    onError: (error: Error) => console.error("Lexical error:", error),
  }));

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <PageIdProvider pageId={pageId}>
        <RichTextPlugin
          contentEditable={<ContentEditable className="outline-none" />}
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <ListPlugin />
        <CheckListPlugin />
        <TablePlugin />
      </PageIdProvider>
    </LexicalComposer>
  );
}
