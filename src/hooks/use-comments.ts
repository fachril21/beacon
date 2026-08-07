"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import { commentsStore } from "@/lib/supabase/stores";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapCommentRow, type CommentRow } from "@/lib/supabase/mappers";

export function usePageComments(pageId: string | undefined) {
  const comments = useSyncExternalStore(commentsStore.subscribe, commentsStore.getState, commentsStore.getState);

  useEffect(() => {
    if (!pageId) return;
    commentsStore.ensureLoaded(`page:${pageId}`, async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from("comments").select("*").eq("page_id", pageId);
      if (error) throw error;
      return ((data ?? []) as CommentRow[]).map(mapCommentRow);
    });
  }, [pageId]);

  return pageId ? comments.filter((c) => c.pageId === pageId) : [];
}

export function useBlockComments(pageId: string | undefined, blockId: string | undefined) {
  const comments = usePageComments(pageId);
  return blockId ? comments.filter((c) => c.blockId === blockId).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)) : [];
}

/**
 * Inserts the Comment, then one Notification row per mentioned User (Epic
 * 16, US16.2) -- excluding the author mentioning themselves, since that's
 * not a notification anyone needs. Both writes are gated by the same
 * Space-membership RLS check (comments_insert_member /
 * notifications_insert_by_commenter, 20260807000100_notifications.sql), so
 * a failed notification insert (e.g. a mentioned userId that isn't actually
 * a Space member) doesn't roll back the comment itself -- the comment is the
 * primary action, notifications are best-effort.
 */
export function useCreateComment() {
  return useCallback(
    async (pageId: string, blockId: string, authorUserId: string, body: string, mentionedUserIds: string[]) => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("comments")
        .insert({
          page_id: pageId,
          block_id: blockId,
          author_user_id: authorUserId,
          body,
          mentioned_user_ids: mentionedUserIds,
        })
        .select()
        .single();
      if (error) throw error;

      const comment = mapCommentRow(data as CommentRow);
      commentsStore.setState((prev) => [...prev, comment]);

      const recipients = mentionedUserIds.filter((id) => id !== authorUserId);
      if (recipients.length > 0) {
        const { error: notifyError } = await supabase.from("notifications").insert(
          recipients.map((recipientUserId) => ({
            recipient_user_id: recipientUserId,
            actor_user_id: authorUserId,
            page_id: pageId,
            comment_id: comment.id,
          })),
        );
        if (notifyError) console.error("[beacon] failed to create mention notifications:", notifyError);
      }

      return comment;
    },
    [],
  );
}
