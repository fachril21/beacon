"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateComment } from "@/hooks/use-comments";
import { useSession } from "@/hooks/use-session";
import { applyMention, findMentionQuery, mentionedIdsInBody, type MentionQuery, type PickedMention } from "@/lib/mentions";
import { describePublishError } from "@/lib/publish-error";
import { cn } from "@/lib/utils";
import type { MentionCandidate } from "@/hooks/use-mention-candidates";

/**
 * Comment input with an @mention picker. Which people are notified is decided
 * from the text at send time — a mention the author deleted again must not
 * ping anyone.
 */
export function CommentComposer({
  pageId,
  blockId,
  candidates,
  onSubmitted,
  placeholder = "Tulis komentar… gunakan @ untuk menyebut seseorang",
  className,
}: {
  pageId: string;
  blockId: string;
  /** People who can be @mentioned (see useMentionCandidates). */
  candidates: MentionCandidate[];
  onSubmitted?: () => void;
  placeholder?: string;
  className?: string;
}) {
  const { user } = useSession();
  const createComment = useCreateComment();
  const [body, setBody] = useState("");
  const [mention, setMention] = useState<MentionQuery | null>(null);
  const [picked, setPicked] = useState<PickedMention[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listboxId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const matches = mention ? candidates.filter((c) => c.name.toLowerCase().includes(mention.query.toLowerCase())) : [];
  const isPickerOpen = mention !== null && matches.length > 0;
  const active = Math.min(activeIndex, Math.max(matches.length - 1, 0));
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  function handleChange(value: string) {
    setBody(value);
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    setMention(findMentionQuery(value, cursor));
    setActiveIndex(0); // the narrowed list starts at its first match again
  }

  /** Discord-style: Up/Down move, Tab or Enter pick, Esc closes — only while the picker is open. */
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!isPickerOpen || event.nativeEvent.isComposing) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((active + 1) % matches.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((active - 1 + matches.length) % matches.length);
        break;
      case "Tab":
      case "Enter":
        event.preventDefault();
        pickMention(matches[active]);
        break;
      case "Escape":
        // Closes only the picker; the side panel treats an un-prevented Esc as "close me".
        event.preventDefault();
        event.stopPropagation();
        setMention(null);
        break;
    }
  }

  function pickMention(candidate: MentionCandidate) {
    if (!mention) return;
    const cursor = textareaRef.current?.selectionStart ?? body.length;
    const next = applyMention(body, cursor, mention, candidate.name);
    setBody(next.text);
    setMention(null);
    setPicked((prev) => (prev.some((p) => p.id === candidate.id) ? prev : [...prev, { id: candidate.id, name: candidate.name }]));
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(next.cursor, next.cursor);
    });
  }

  async function handleSubmit() {
    const text = body.trim();
    if (!text || !user || isSending) return;
    setIsSending(true);
    try {
      await createComment(pageId, blockId, user.id, text, mentionedIdsInBody(text, picked));
      setBody("");
      setPicked([]);
      setMention(null);
      onSubmitted?.();
    } catch (error) {
      console.error("[beacon] failed to post comment:", error);
      toast.error("Gagal mengirim komentar, silakan coba lagi.", { description: describePublishError(error) });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <Textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-controls={isPickerOpen ? listboxId : undefined}
        aria-activedescendant={isPickerOpen ? optionId(active) : undefined}
        placeholder={placeholder}
        className="min-h-16"
      />
      {isPickerOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Sebut anggota"
          className="absolute bottom-full left-0 z-10 mb-1 max-h-48 w-56 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-[0_8px_24px_-8px_oklch(0.06_0.02_250_/_0.6)]"
        >
          {matches.map((candidate, index) => (
            <div
              key={candidate.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              // mousedown would move focus out of the textarea before the click lands.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pickMention(candidate)}
              onMouseEnter={() => setActiveIndex(index)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-body-sm text-foreground break-all",
                index === active && "bg-accent",
              )}
            >
              {candidate.name}
            </div>
          ))}
        </div>
      )}
      <Button size="sm" onClick={() => void handleSubmit()} disabled={!body.trim() || isSending} className="mt-2 w-full">
        Kirim
      </Button>
    </div>
  );
}
