"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUpdatePageContent } from "@/hooks/use-pages";
import type { SerializedEditorState } from "lexical";

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "syncing" | "error";

const AUTOSAVE_DEBOUNCE_MS = 2500; // fires <=3s after the last keystroke (PRD.md §5.1)

/**
 * Debounced autosave to the mock Page store, with offline/retry states
 * matching Flow 3's failure path. `simulateFailure` is a dev-only escape
 * hatch (Stage 1 has no real network to fail) mirroring the pattern used on
 * the auth screens.
 */
export function usePageAutosave(pageId: string, simulateFailure = false) {
  const updateContent = useUpdatePageContent();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const pendingContentRef = useRef<SerializedEditorState | null>(null);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      if (pendingContentRef.current) {
        setStatus("syncing");
        setTimeout(() => {
          if (pendingContentRef.current) {
            updateContent(pageId, pendingContentRef.current);
            pendingContentRef.current = null;
          }
          setStatus("saved");
          savedFadeRef.current = setTimeout(() => setStatus("idle"), 2000);
        }, 600);
      }
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
    (content: SerializedEditorState) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);

      if (!isOnline) {
        pendingContentRef.current = content;
        setStatus("offline");
        return;
      }

      setStatus("saving");
      timeoutRef.current = setTimeout(() => {
        if (simulateFailure) {
          setStatus("error");
          return;
        }
        updateContent(pageId, content);
        setStatus("saved");
        savedFadeRef.current = setTimeout(() => setStatus("idle"), 2000);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [isOnline, pageId, simulateFailure, updateContent],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
    };
  }, []);

  return { status, scheduleSave };
}
