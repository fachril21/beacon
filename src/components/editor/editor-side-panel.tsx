"use client";

import { useMemo, type KeyboardEvent, type RefObject } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageComments } from "@/hooks/use-comments";
import { useUser } from "@/hooks/use-users";
import { PageToc } from "./page-toc";
import { VersionHistoryPanel } from "./version-history-panel";
import { EDITOR_SIDE_PANEL_ID, type EditorSidePanelTab } from "./editor-side-panel-tab";
import type { Page, PageContent } from "@/lib/types";


// Underline sits on the header's bottom border and uses the active-state green (wireframe v2 §3.3).
const TAB_TRIGGER_CLASS =
  "h-full flex-none rounded-none px-0.5 text-body-sm after:bg-primary group-data-horizontal/tabs:after:bottom-[-1px]";

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function CommentAuthor({ userId }: { userId: string }) {
  const author = useUser(userId);
  return <>{author?.name ?? "Pengguna"}</>;
}

/**
 * A Comment's blockId is either a BlockNote block id or a ScreenshotBlock.id
 * (see Comment in lib/types.ts). Resolve it to the BlockNote block that
 * renders it, so "Lihat blok" can scroll to the `[data-id]` element.
 */
function findAnchorBlockId(blocks: PageContent, commentBlockId: string): string | null {
  for (const block of blocks) {
    const props = block.props as { screenshotBlockId?: string } | undefined;
    if (block.id && (block.id === commentBlockId || props?.screenshotBlockId === commentBlockId)) return block.id;
    if (block.children) {
      const found = findAnchorBlockId(block.children as PageContent, commentBlockId);
      if (found) return found;
    }
  }
  return null;
}

function PageCommentList({ page, scrollRootRef }: { page: Page; scrollRootRef: RefObject<HTMLElement | null> }) {
  const comments = usePageComments(page.id);
  const sorted = useMemo(() => [...comments].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [comments]);

  if (sorted.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-body-sm text-muted-foreground">
        Belum ada komentar. Tambahkan komentar lewat ikon komentar pada blok screenshot.
      </p>
    );
  }

  function scrollToBlock(blockId: string) {
    scrollRootRef.current?.querySelector<HTMLElement>(`[data-id="${blockId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <ul className="flex flex-col gap-1">
      {sorted.map((comment) => {
        const anchorId = findAnchorBlockId(page.content, comment.blockId);
        return (
          <li key={comment.id} className="flex flex-col gap-0.5 rounded-md px-2.5 py-2 hover:bg-accent">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-body-sm font-medium text-foreground">
                <CommentAuthor userId={comment.authorUserId} />
              </span>
              <span className="shrink-0 text-caption text-muted-foreground">{formatTimestamp(comment.createdAt)}</span>
            </div>
            <p className="text-body-sm whitespace-pre-wrap text-foreground">{comment.body}</p>
            {anchorId && (
              <button
                type="button"
                onClick={() => scrollToBlock(anchorId)}
                className="self-start rounded-sm text-caption text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Lihat blok
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Editor right panel (wireframe v2 §3.3): one 320px column with Daftar isi |
 * Komentar (n) | Riwayat tabs. Which tab is open — and whether the panel is
 * open at all — is owned by the editor page, so the topbar icons and the
 * "Riwayat Versi" menu item can drive it.
 */
export function EditorSidePanel({
  page,
  tab,
  onTabChange,
  onClose,
  scrollRootRef,
}: {
  page: Page;
  tab: EditorSidePanelTab;
  onTabChange: (tab: EditorSidePanelTab) => void;
  onClose: () => void;
  scrollRootRef: RefObject<HTMLElement | null>;
}) {
  const commentCount = usePageComments(page.id).length;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    // Popups inside the panel (none today) would handle Esc themselves first.
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <aside
      id={EDITOR_SIDE_PANEL_ID}
      aria-label="Panel samping"
      onKeyDown={handleKeyDown}
      className="flex w-right-panel shrink-0 flex-col border-l border-border bg-background"
    >
      <Tabs value={tab} onValueChange={(value) => onTabChange(value as EditorSidePanelTab)} className="min-h-0 flex-1 gap-0">
        <div className="flex items-center gap-2 border-b border-border pr-3 pl-4">
          <TabsList variant="line" className="h-11 gap-3 p-0">
            <TabsTrigger value="toc" className={TAB_TRIGGER_CLASS}>
              Daftar isi
            </TabsTrigger>
            <TabsTrigger value="comments" className={TAB_TRIGGER_CLASS}>
              Komentar{" "}
              <span className="text-caption text-muted-foreground tabular-nums">{commentCount}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className={TAB_TRIGGER_CLASS}>
              Riwayat
            </TabsTrigger>
          </TabsList>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Tutup panel" className="ml-auto">
            <X className="size-4" />
          </Button>
        </div>

        <TabsContent value="toc" className="min-h-0 overflow-y-auto px-3.5 py-4">
          <PageToc content={page.content} scrollRootRef={scrollRootRef} />
        </TabsContent>
        <TabsContent value="comments" className="min-h-0 overflow-y-auto p-2">
          <PageCommentList page={page} scrollRootRef={scrollRootRef} />
        </TabsContent>
        <TabsContent value="history" className="flex min-h-0 flex-col">
          <VersionHistoryPanel page={page} onRestored={onClose} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
