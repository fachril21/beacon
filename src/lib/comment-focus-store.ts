"use client";

/**
 * "Show the comments of this block" requests, per Page. The editor's block
 * side menu writes here; the Komentar tab reads it to filter to one block
 * and aim its composer at it, and the editor page watches `nonce` to open
 * the side panel on that tab. `nonce` bumps on every request so asking for
 * the same block twice still re-opens a panel the user closed.
 */
import { useSyncExternalStore } from "react";
import { createStore } from "@/lib/store";

/** block_id used for a comment on the Page as a whole rather than on one block. */
export const PAGE_COMMENT_BLOCK_ID = "page";

export interface CommentFocus {
  blockId: string | null;
  nonce: number;
  /** A single comment to scroll to and highlight (from a notification link). */
  highlightedCommentId: string | null;
}

const NO_FOCUS: CommentFocus = { blockId: null, nonce: 0, highlightedCommentId: null };

const focusStore = createStore<Readonly<Record<string, CommentFocus>>>({});

export function focusBlockComments(pageId: string, blockId: string): void {
  focusStore.setState((prev) => ({
    ...prev,
    [pageId]: { blockId, nonce: (prev[pageId]?.nonce ?? 0) + 1, highlightedCommentId: null },
  }));
}

/** Open one comment: narrow to its block (null = page-level, show everything), highlight it, and ask for the panel. */
export function focusComment(pageId: string, commentId: string, blockId: string | null): void {
  focusStore.setState((prev) => ({
    ...prev,
    [pageId]: { blockId, nonce: (prev[pageId]?.nonce ?? 0) + 1, highlightedCommentId: commentId },
  }));
}

export function clearCommentHighlight(pageId: string): void {
  focusStore.setState((prev) => {
    const current = prev[pageId];
    if (!current || current.highlightedCommentId === null) return prev;
    return { ...prev, [pageId]: { ...current, highlightedCommentId: null } };
  });
}

export function clearBlockCommentFocus(pageId: string): void {
  focusStore.setState((prev) => {
    const current = prev[pageId];
    if (!current || current.blockId === null) return prev;
    return { ...prev, [pageId]: { ...current, blockId: null } };
  });
}

export function useCommentFocus(pageId: string): CommentFocus {
  return useSyncExternalStore(
    focusStore.subscribe,
    () => focusStore.getState()[pageId] ?? NO_FOCUS,
    () => NO_FOCUS,
  );
}
