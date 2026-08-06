"use client";

import { useSyncExternalStore, useCallback, useMemo } from "react";
import { feedbackStore, nextId } from "@/lib/data-store";

export function usePageFeedback(pageId: string | undefined) {
  const feedback = useSyncExternalStore(feedbackStore.subscribe, feedbackStore.getState, feedbackStore.getState);
  return useMemo(() => (pageId ? feedback.filter((f) => f.pageId === pageId) : []), [feedback, pageId]);
}

export function useHelpfulnessRate(pageId: string | undefined) {
  const feedback = usePageFeedback(pageId);
  const yes = feedback.filter((f) => f.helpful).length;
  const total = feedback.length;
  return { yes, total, rate: total > 0 ? yes / total : null };
}

export function useCreateFeedback() {
  return useCallback((pageId: string, helpful: boolean, comment: string | null) => {
    feedbackStore.setState((prev) => [
      ...prev,
      { id: nextId("feedback"), pageId, helpful, comment, createdAt: new Date().toISOString() },
    ]);
  }, []);
}
