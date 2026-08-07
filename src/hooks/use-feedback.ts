"use client";

import { useSyncExternalStore, useCallback, useEffect, useMemo } from "react";
import { feedbackStore } from "@/lib/supabase/stores";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapFeedbackRow, type FeedbackRow } from "@/lib/supabase/mappers";

/**
 * `feedback_select_editor` RLS restricts this to editors/admins of the
 * owning Space (20260806100100_rls_policies.sql) — this is the author-facing
 * read, never called from the public FeedbackWidget.
 */
export function usePageFeedback(pageId: string | undefined) {
  const feedback = useSyncExternalStore(feedbackStore.subscribe, feedbackStore.getState, feedbackStore.getState);

  useEffect(() => {
    if (!pageId) return;
    feedbackStore.ensureLoaded(`page:${pageId}`, async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from("feedback").select("*").eq("page_id", pageId);
      if (error) throw error;
      return ((data ?? []) as FeedbackRow[]).map(mapFeedbackRow);
    });
  }, [pageId]);

  return useMemo(() => (pageId ? feedback.filter((f) => f.pageId === pageId) : []), [feedback, pageId]);
}

export function useHelpfulnessRate(pageId: string | undefined) {
  const feedback = usePageFeedback(pageId);
  const yes = feedback.filter((f) => f.helpful).length;
  const total = feedback.length;
  return { yes, total, rate: total > 0 ? yes / total : null };
}

/**
 * Anonymous single-click Yes/No on a published page (Flow 5 step 3-4).
 * `feedback_insert_public_on_published` RLS allows `anon` directly — no
 * session required — and enforces the per-IP rate limit server-side
 * (20260807000000_feedback_rate_limit.sql), so a rejected insert here is a
 * real, database-enforced rejection, not just a client-side guard.
 */
export function useCreateFeedback() {
  return useCallback(async (pageId: string, helpful: boolean, comment: string | null) => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("feedback")
      .insert({ page_id: pageId, helpful, comment })
      .select()
      .single();
    if (error) throw error;

    feedbackStore.setState((prev) => [...prev, mapFeedbackRow(data as FeedbackRow)]);
  }, []);
}
