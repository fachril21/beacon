"use client";

import { use, useCallback, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/beacon/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSpace, useSpaceRole } from "@/hooks/use-spaces";
import { usePage } from "@/hooks/use-pages";
import { useTitleAutosave } from "@/hooks/use-title-autosave";
import { useSession } from "@/hooks/use-session";
import { useUser } from "@/hooks/use-users";
import { PageEditor } from "@/components/editor/page-editor";
import { PageEditorToolbar } from "@/components/editor/page-editor-toolbar";
import { PageToc } from "@/components/editor/page-toc";
import { VersionHistoryPanel } from "@/components/editor/version-history-panel";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { SaveStatus } from "@/hooks/use-page-autosave";

export default function PageEditorPage({ params }: { params: Promise<{ spaceId: string; pageId: string }> }) {
  const { spaceId, pageId } = use(params);
  const { user } = useSession();
  const space = useSpace(spaceId);
  const page = usePage(pageId);
  const author = useUser(page?.createdByUserId);
  const role = useSpaceRole(spaceId, user?.id);
  const canEdit = role === "editor" || role === "admin";
  const handleTitleSaveError = useCallback(() => {
    toast.error("Judul gagal disimpan, silakan coba lagi.");
  }, []);
  const { title, scheduleTitleSave, flushTitleSave } = useTitleAutosave(pageId, page?.title, handleTitleSaveError);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const scrollRootRef = useRef<HTMLElement | null>(null);

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
          role={role}
          onOpenVersionHistory={() => setIsVersionHistoryOpen(true)}
        />
        {/* Wide, centered column with generous surrounding whitespace; the ToC rail shares the centered group so the column shifts to make room for it, same as it collapsing below xl. */}
        <main ref={scrollRootRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-app-shell justify-center gap-8 px-80 py-10">
            <div className="w-full max-w-editor-column">
              <input
                id="page-title"
                name="page-title"
                value={title}
                onChange={(e) => scheduleTitleSave(e.target.value)}
                onBlur={() => void flushTitleSave()}
                readOnly={!canEdit}
                placeholder="Halaman tanpa judul"
                autoFocus={!page.title}
                className="w-full border-none bg-transparent text-h1 font-bold text-foreground outline-none placeholder:text-muted-foreground read-only:cursor-default"
              />
              <div className="mt-6">
                <PageEditor key={pageId} page={page} onStatusChange={setSaveStatus} editable={canEdit} />
              </div>

              {/* Footer meta row — low-emphasis, avatar + last-modified timestamp */}
              <div className="mt-16 flex items-center gap-2 border-t border-border pt-4">
                <Avatar size="sm">
                  <AvatarImage src={author?.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback>{author?.name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                </Avatar>
                <p className="text-caption text-muted-foreground">
                  {author?.name && <span>Dibuat oleh {author.name} · </span>}
                  Terakhir diubah {formatRelativeTime(page.updatedAt)}
                </p>
              </div>
            </div>
            <PageToc content={page.content} scrollRootRef={scrollRootRef} />
          </div>
        </main>
      </div>
      {isVersionHistoryOpen && <VersionHistoryPanel page={page} onClose={() => setIsVersionHistoryOpen(false)} />}
    </div>
  );
}
