"use client";

import { displayName } from "@/lib/display-name";
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageSquare } from "lucide-react";
import { useBlockComments } from "@/hooks/use-comments";
import { useUser } from "@/hooks/use-users";
import { useSession } from "@/hooks/use-session";
import { useMentionCandidates } from "@/hooks/use-mention-candidates";
import { usePageId } from "./page-id-context";
import { CommentBody } from "./comment-body";
import { CommentComposer } from "./comment-composer";
import { markCommentsRead } from "@/lib/comment-read-store";
import { cn } from "@/lib/utils";

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function CommentAuthor({ userId }: { userId: string }) {
  const author = useUser(userId);
  return <>{displayName(author)}</>;
}

/** The comment popover on a screenshot block's corner; every other block comments through the editor's side menu. */
export function CommentThreadPanel({ blockId, className }: { blockId: string; className?: string }) {
  const pageId = usePageId();
  const { user } = useSession();
  const comments = useBlockComments(pageId, blockId);
  const candidates = useMentionCandidates(pageId, user?.id);
  const [open, setOpen] = useState(false);

  // An open thread is a read thread (including a comment that arrives while it is open).
  const newestCommentAt = comments.reduce<string | null>((newest, c) => (newest === null || c.createdAt > newest ? c.createdAt : newest), null);
  const userId = user?.id;
  useEffect(() => {
    if (open && userId && newestCommentAt) markCommentsRead(userId, pageId, blockId, newestCommentAt);
  }, [open, userId, pageId, blockId, newestCommentAt]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Komentar"
            className={cn(
              "flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground",
              className,
            )}
          />
        }
      >
        <MessageSquare className="size-3.5" />
        {comments.length > 0 && <span className="ml-0.5 text-[10px] font-semibold">{comments.length}</span>}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="max-h-64 overflow-y-auto p-3">
          {comments.length === 0 ? (
            <p className="py-3 text-center text-caption text-muted-foreground">Belum ada komentar.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-body-sm font-medium text-foreground">
                      <CommentAuthor userId={comment.authorUserId} />
                    </span>
                    <span className="text-caption text-muted-foreground">{formatTimestamp(comment.createdAt)}</span>
                  </div>
                  <CommentBody comment={comment} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-border p-3">
          <CommentComposer pageId={pageId} blockId={blockId} candidates={candidates} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
