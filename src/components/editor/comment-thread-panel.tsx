"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare } from "lucide-react";
import { useBlockComments, useCreateComment } from "@/hooks/use-comments";
import { useUsers, useUser } from "@/hooks/use-users";
import { useSession } from "@/hooks/use-session";
import { usePageId } from "./page-id-context";
import { cn } from "@/lib/utils";

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function CommentAuthor({ userId }: { userId: string }) {
  const author = useUser(userId);
  return <>{author?.name ?? "Pengguna"}</>;
}

export function CommentThreadPanel({ blockId, className }: { blockId: string; className?: string }) {
  const pageId = usePageId();
  const { user } = useSession();
  const comments = useBlockComments(pageId, blockId);
  const createComment = useCreateComment();
  const organizationUsers = useUsers(user?.organizationId);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionCandidates =
    mentionQuery !== null
      ? organizationUsers.filter((u) => u.name.toLowerCase().includes(mentionQuery.toLowerCase()))
      : [];

  function handleChange(value: string) {
    setBody(value);
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const uptoCursor = value.slice(0, cursor);
    const match = uptoCursor.match(/@([^\s@]*)$/);
    setMentionQuery(match ? match[1] : null);
  }

  function insertMention(name: string, userId: string) {
    const cursor = textareaRef.current?.selectionStart ?? body.length;
    const uptoCursor = body.slice(0, cursor);
    const replaced = uptoCursor.replace(/@([^\s@]*)$/, `@${name} `);
    setBody(replaced + body.slice(cursor));
    setMentionQuery(null);
    setMentionedUserIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
  }

  async function handleSubmit() {
    if (!body.trim() || !user) return;
    try {
      await createComment(pageId, blockId, user.id, body.trim(), mentionedUserIds);
      setBody("");
      setMentionedUserIds([]);
    } catch {
      toast.error("Gagal mengirim komentar, silakan coba lagi.");
    }
  }

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
                  <p className="text-body-sm text-foreground">{comment.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="relative border-t border-border p-3">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Tulis komentar… gunakan @ untuk menyebut seseorang"
            className="min-h-16"
          />
          {mentionQuery !== null && mentionCandidates.length > 0 && (
            <div className="absolute bottom-16 left-3 z-10 w-56 rounded-md border border-border bg-popover p-1 shadow-[0_8px_24px_-8px_oklch(0.06_0.02_250_/_0.6)]">
              {mentionCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => insertMention(candidate.name, candidate.id)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-body-sm text-foreground hover:bg-accent"
                >
                  {candidate.name}
                </button>
              ))}
            </div>
          )}
          <Button size="sm" onClick={() => void handleSubmit()} disabled={!body.trim()} className="mt-2 w-full">
            Kirim
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
