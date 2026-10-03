"use client";

import { displayName } from "@/lib/display-name";
import { useEffect, useMemo, type KeyboardEvent, type RefObject } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageComments } from "@/hooks/use-comments";
import { useUser } from "@/hooks/use-users";
import { useSession } from "@/hooks/use-session";
import { useMentionCandidates } from "@/hooks/use-mention-candidates";
import { extractBlockOwnText } from "@/lib/extract-text";
import { PAGE_COMMENT_BLOCK_ID, clearBlockCommentFocus, clearCommentHighlight, useCommentFocus } from "@/lib/comment-focus-store";
import { cn } from "@/lib/utils";
import { findAnchorBlock } from "@/lib/comment-anchors";
import { markCommentsRead } from "@/lib/comment-read-store";
import { CommentBody } from "./comment-body";
import { CommentComposer } from "./comment-composer";
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
  return <>{displayName(author)}</>;
}

type AnyBlock = PageContent[number];

function describeBlock(block: AnyBlock | null): string {
  if (!block) return "Blok";
  if ((block.type as string) === "screenshot") return "Gambar";
  const text = extractBlockOwnText(block.content);
  return text ? (text.length > 40 ? `${text.slice(0, 40)}…` : text) : "Blok";
}

const BLOCK_HIGHLIGHT_CLASSES = ["ring-2", "ring-primary/60", "rounded-md"];
const BLOCK_HIGHLIGHT_MS = 1500;
const COMMENT_HIGHLIGHT_MS = 4000;

function CommentsTab({ page, scrollRootRef }: { page: Page; scrollRootRef: RefObject<HTMLElement | null> }) {
  const { user } = useSession();
  const comments = usePageComments(page.id);
  const focus = useCommentFocus(page.id);
  const candidates = useMentionCandidates(page.id, user?.id);

  const focusedBlock = focus.blockId ? findAnchorBlock(page.content, focus.blockId) : null;
  const visible = useMemo(() => {
    const scoped = focus.blockId ? comments.filter((c) => c.blockId === focus.blockId) : comments;
    // A single block's thread reads top-down; the page-wide list shows the newest first.
    return [...scoped].sort((a, b) => (focus.blockId ? (a.createdAt < b.createdAt ? -1 : 1) : a.createdAt < b.createdAt ? 1 : -1));
  }, [comments, focus.blockId]);

  // Showing a thread is reading it: stop marking those blocks in the editor.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const newestByBlock = new Map<string, string>();
    for (const comment of visible) {
      const newest = newestByBlock.get(comment.blockId);
      if (newest === undefined || comment.createdAt > newest) newestByBlock.set(comment.blockId, comment.createdAt);
    }
    for (const [blockId, newest] of newestByBlock) markCommentsRead(userId, page.id, blockId, newest);
  }, [visible, userId, page.id]);

  // A comment opened from a notification: bring it into view, keep it marked for a moment.
  const highlightedId = focus.highlightedCommentId;
  useEffect(() => {
    if (!highlightedId) return;
    document
      .querySelector<HTMLElement>(`[data-comment-id="${CSS.escape(highlightedId)}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => clearCommentHighlight(page.id), COMMENT_HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightedId, visible, page.id]);

  function scrollToBlock(blockId: string) {
    const element = scrollRootRef.current?.querySelector<HTMLElement>(`[data-id="${blockId}"]`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add(...BLOCK_HIGHLIGHT_CLASSES);
    setTimeout(() => element.classList.remove(...BLOCK_HIGHLIGHT_CLASSES), BLOCK_HIGHLIGHT_MS);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {focus.blockId && (
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <span className="min-w-0 truncate text-caption text-muted-foreground">
            Komentar pada: <span className="text-foreground">{describeBlock(focusedBlock)}</span>
          </span>
          <button
            type="button"
            onClick={() => clearBlockCommentFocus(page.id)}
            className="shrink-0 rounded-sm text-caption text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Lihat semua komentar
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-body-sm text-muted-foreground">
            Belum ada komentar. Tulis di bawah, atau klik ikon komentar di samping sebuah blok untuk berkomentar pada blok itu.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {visible.map((comment) => {
              const anchor = findAnchorBlock(page.content, comment.blockId);
              return (
                <li
                  key={comment.id}
                  data-comment-id={comment.id}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-md px-2.5 py-2 hover:bg-accent",
                    comment.id === highlightedId && "bg-primary/10 ring-1 ring-primary/50",
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-body-sm font-medium text-foreground">
                      <CommentAuthor userId={comment.authorUserId} />
                    </span>
                    <span className="shrink-0 text-caption text-muted-foreground">{formatTimestamp(comment.createdAt)}</span>
                  </div>
                  <CommentBody comment={comment} />
                  {anchor?.id && (
                    <button
                      type="button"
                      onClick={() => scrollToBlock(anchor.id as string)}
                      className="self-start rounded-sm text-caption text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Lihat blok
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="border-t border-border p-3">
        <CommentComposer
          key={focus.blockId ?? PAGE_COMMENT_BLOCK_ID}
          pageId={page.id}
          blockId={focus.blockId ?? PAGE_COMMENT_BLOCK_ID}
          candidates={candidates}
        />
      </div>
    </div>
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
  canRestore,
}: {
  page: Page;
  tab: EditorSidePanelTab;
  onTabChange: (tab: EditorSidePanelTab) => void;
  onClose: () => void;
  scrollRootRef: RefObject<HTMLElement | null>;
  /** Editors/admins only — RLS rejects a Viewer's restore, so the action is hidden for them. */
  canRestore: boolean;
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
        <TabsContent value="comments" className="flex min-h-0 flex-col">
          <CommentsTab page={page} scrollRootRef={scrollRootRef} />
        </TabsContent>
        <TabsContent value="history" className="flex min-h-0 flex-col">
          <VersionHistoryPanel page={page} canRestore={canRestore} onRestored={onClose} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
