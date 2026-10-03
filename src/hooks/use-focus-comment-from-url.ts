"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { usePageComments } from "@/hooks/use-comments";
import { PAGE_COMMENT_BLOCK_ID, focusComment } from "@/lib/comment-focus-store";

const COMMENT_PARAM = "comment";

/**
 * A notification links to `?comment=<id>`. Once that comment has loaded, open
 * the Komentar tab on its block with the comment highlighted, then drop the
 * parameter from the URL (so a reload does not replay it and the same
 * notification can be opened again).
 */
export function useFocusCommentFromUrl(pageId: string): void {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  // useSearchParams() can be null outside a router (tests, pages-router fallbacks).
  const commentId = searchParams?.get(COMMENT_PARAM) ?? null;
  const comments = usePageComments(pageId);
  const target = commentId ? comments.find((c) => c.id === commentId) : undefined;

  useEffect(() => {
    if (!target) return;
    focusComment(pageId, target.id, target.blockId === PAGE_COMMENT_BLOCK_ID ? null : target.blockId);
    window.history.replaceState(null, "", pathname);
  }, [target, pageId, pathname]);
}
