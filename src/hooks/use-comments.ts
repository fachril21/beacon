"use client";

import { useSyncExternalStore, useCallback } from "react";
import { commentsStore, nextId } from "@/lib/data-store";

export function usePageComments(pageId: string | undefined) {
  const comments = useSyncExternalStore(commentsStore.subscribe, commentsStore.getState, commentsStore.getState);
  return pageId ? comments.filter((c) => c.pageId === pageId) : [];
}

export function useBlockComments(pageId: string | undefined, blockId: string | undefined) {
  const comments = usePageComments(pageId);
  return blockId ? comments.filter((c) => c.blockId === blockId).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)) : [];
}

export function useCreateComment() {
  return useCallback((pageId: string, blockId: string, authorUserId: string, body: string, mentionedUserIds: string[]) => {
    commentsStore.setState((prev) => [
      ...prev,
      { id: nextId("comment"), pageId, blockId, authorUserId, body, mentionedUserIds, createdAt: new Date().toISOString() },
    ]);
  }, []);
}
