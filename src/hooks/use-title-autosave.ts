"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUpdatePageTitle } from "@/hooks/use-pages";

const TITLE_AUTOSAVE_DEBOUNCE_MS = 800;

/**
 * Owns a Page title's local editing state end to end: syncing it from the
 * loaded Page, and debounced/failure-visible saving.
 *
 * Sync matters because `usePage()` reads from an in-memory store that is
 * empty until its first fetch resolves — on a hard reload, `loadedTitle` is
 * `undefined` on the very first render. A plain `useState(loadedTitle ?? "")`
 * only reads that argument once, at mount, so it freezes at "" forever even
 * after the real title arrives a moment later — the input shows the
 * untitled placeholder regardless of whether anything was ever saved.
 *
 * Debouncing matters because firing an update on every keystroke both
 * floods Supabase and lets concurrent requests resolve out of order — a
 * stale/empty in-flight request completing after a newer one silently
 * reverts the title in the database while the input keeps showing text
 * that was never actually persisted. That call was also fire-and-forget: a
 * rejected write (RLS, network) had nowhere to go, so the failure was
 * invisible until the next reload.
 */
export function useTitleAutosave(pageId: string, loadedTitle: string | undefined, onError?: (error: unknown) => void) {
  const updateTitle = useUpdatePageTitle();
  const [title, setTitle] = useState(loadedTitle ?? "");
  const syncedForPageIdRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    if (loadedTitle !== undefined && syncedForPageIdRef.current !== pageId) {
      setTitle(loadedTitle);
      syncedForPageIdRef.current = pageId;
    }
  }, [pageId, loadedTitle]);

  const persist = useCallback(
    async (id: string, value: string) => {
      pendingRef.current = null;
      try {
        await updateTitle(id, value);
      } catch (error) {
        onError?.(error);
      }
    },
    [updateTitle, onError],
  );

  const scheduleTitleSave = useCallback(
    (value: string) => {
      setTitle(value);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      pendingRef.current = value;
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        void persist(pageId, value);
      }, TITLE_AUTOSAVE_DEBOUNCE_MS);
    },
    [pageId, persist],
  );

  const flushTitleSave = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingRef.current !== null) {
      await persist(pageId, pendingRef.current);
    }
  }, [pageId, persist]);

  // Flushes whatever was pending for the *previous* pageId/persist identity
  // before switching — the cleanup closure captures that prior render, not
  // the current one, which is exactly the Page being navigated away from.
  useEffect(() => {
    return () => {
      void flushTitleSave();
    };
  }, [flushTitleSave]);

  return { title, scheduleTitleSave, flushTitleSave };
}
