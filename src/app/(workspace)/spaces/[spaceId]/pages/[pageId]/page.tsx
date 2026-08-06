"use client";

import { use, useState } from "react";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/beacon/empty-state";
import { useSpace } from "@/hooks/use-spaces";
import { usePage, useUpdatePageTitle } from "@/hooks/use-pages";
import { PageEditor } from "@/components/editor/page-editor";
import { PageEditorToolbar } from "@/components/editor/page-editor-toolbar";
import { VersionHistoryPanel } from "@/components/editor/version-history-panel";
import type { SaveStatus } from "@/hooks/use-page-autosave";

export default function PageEditorPage({ params }: { params: Promise<{ spaceId: string; pageId: string }> }) {
  const { spaceId, pageId } = use(params);
  const space = useSpace(spaceId);
  const page = usePage(pageId);
  const updateTitle = useUpdatePageTitle();
  const [title, setTitle] = useState(page?.title ?? "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);

  if (!page || !space) {
    return (
      <main className="flex-1 overflow-y-auto">
        <EmptyState icon={FileText} title="Halaman tidak ditemukan" className="mt-16" />
      </main>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        <PageEditorToolbar
          page={page}
          space={space}
          title={title}
          saveStatus={saveStatus}
          onOpenVersionHistory={() => setIsVersionHistoryOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-editor-column px-6 py-10">
            <input
              id="page-title"
              name="page-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                updateTitle(pageId, e.target.value);
              }}
              placeholder="Halaman tanpa judul"
              autoFocus={!page.title}
              className="w-full border-none bg-transparent text-h1 font-bold text-foreground outline-none placeholder:text-muted-foreground"
            />
            <div className="mt-6">
              <PageEditor key={pageId} page={page} onStatusChange={setSaveStatus} />
            </div>
          </div>
        </main>
      </div>
      {isVersionHistoryOpen && <VersionHistoryPanel page={page} onClose={() => setIsVersionHistoryOpen(false)} />}
    </div>
  );
}
