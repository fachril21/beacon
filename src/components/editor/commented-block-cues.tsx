"use client";

import { useMemo } from "react";
import { usePageComments } from "@/hooks/use-comments";
import { useSession } from "@/hooks/use-session";
import { commentCueCss, unreadBlockCounts } from "@/lib/comment-anchors";
import { lastReadAt, useCommentReadMarks } from "@/lib/comment-read-store";
import type { Page } from "@/lib/types";

/**
 * Marks, in the right margin, every block of the page that has comments the
 * user has not read yet — read ones (see CommentsTab / the screenshot
 * popover) stop being marked. Renders only a stylesheet.
 */
export function CommentedBlockCues({ page }: { page: Page }) {
  const { user } = useSession();
  const userId = user?.id;
  const comments = usePageComments(page.id);
  const marks = useCommentReadMarks();

  const css = useMemo(() => {
    const readAt = (blockId: string) => (userId ? lastReadAt(marks, userId, page.id, blockId) : undefined);
    return commentCueCss([...unreadBlockCounts(page.content, comments, readAt, userId).keys()]);
  }, [page.id, page.content, comments, marks, userId]);

  return css ? <style data-comment-cues>{css}</style> : null;
}
