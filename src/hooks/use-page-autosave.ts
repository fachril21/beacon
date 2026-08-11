"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUpdatePageContent } from "@/hooks/use-pages";
import { savePendingEdit, loadPendingEdit, clearPendingEdit } from "@/lib/offline-buffer";
import type { PageContent } from "@/lib/types";

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "syncing" | "error";

const AUTOSAVE_DEBOUNCE_MS = 2500; // fires <=3s after the last keystroke (PRD.md §5.1)
const RETRY_DELAY_MS = 4000;

/**
 * Debounced autosave to Supabase, with an IndexedDB fallback buffer so an
 * edit that fails to save (offline, or a real request failure) survives a
 * crash/reload and is retried automatically — Flow 3's failure path, for
 * real (Epic 11 US11.1), not simulated.
 */
export function usePageAutosave(pageId: string, simulateFailure = false) {
  const updateContent = useUpdatePageContent();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  // A retry needs to call "whatever persistNow is on the next render," not
  // the specific closure that scheduled it — a plain self-reference inside
  // the useCallback body would instead pin the retry to a stale closure.
  const persistNowRef = useRef<(content: PageContent) => Promise<void>>(async () => {});

  const persistNow = useCallback(
    async (content: PageContent) => {
      if (simulateFailure) {
        await savePendingEdit(pageId, content);
        setStatus("error");
        return;
      }
      try {
        await updateContent(pageId, content);
        await clearPendingEdit(pageId);
        setStatus("saved");
        savedFadeRef.current = setTimeout(() => setStatus("idle"), 2000);
      } catch {
        await savePendingEdit(pageId, content);
        setStatus("error");
        retryRef.current = setTimeout(() => void persistNowRef.current(content), RETRY_DELAY_MS);
      }
    },
    [pageId, simulateFailure, updateContent],
  );

  useEffect(() => {
    persistNowRef.current = persistNow;
  }, [persistNow]);

  // Crash/reload recovery: a buffered edit from before this mount means the
  // last session ended without a confirmed save — flush it immediately.
  useEffect(() => {
    let cancelled = false;
    loadPendingEdit(pageId).then((buffered) => {
      if (buffered && !cancelled) {
        setStatus("syncing");
        void persistNow(buffered);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      loadPendingEdit(pageId).then((buffered) => {
        if (buffered) {
          setStatus("syncing");
          void persistNow(buffered);
        }
      });
    }
    function handleOffline() {
      setIsOnline(false);
      setStatus("offline");
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  const scheduleSave = useCallback(
    (content: PageContent) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);

      if (!isOnline) {
        void savePendingEdit(pageId, content);
        setStatus("offline");
        return;
      }

      setStatus("saving");
      timeoutRef.current = setTimeout(() => {
        void persistNow(content);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [isOnline, pageId, persistNow],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

  return { status, scheduleSave };
}
