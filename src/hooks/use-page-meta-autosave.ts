"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUpdatePageMeta } from "@/hooks/use-pages";
import { useEditorRevision } from "@/lib/editor-revision-store";

const META_AUTOSAVE_DEBOUNCE_MS = 800;

/**
 * Owns a Page description's local editing state — the same contract as
 * `useTitleAutosave` (sync from the loaded Page, debounce writes, flush on
 * unmount) but for the optional one-line field under the title. The sync on
 * `revision` matters for the same reason it does there: without it, the input
 * freezes at its mount-time value and a Version restore never reaches it.
 */
export function useDescriptionAutosave(
  pageId: string,
  loadedDescription: string | undefined,
  onError?: (error: unknown) => void,
) {
  const updateMeta = useUpdatePageMeta();
  const [description, setDescription] = useState(loadedDescription ?? "");
  const syncedForRef = useRef<string | null>(null);
  const revision = useEditorRevision(pageId);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    const syncKey = `${pageId}:${revision}`;
    if (loadedDescription !== undefined && syncedForRef.current !== syncKey) {
      // Drop an unsaved keystroke buffer: it predates the value being adopted.
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      pendingRef.current = null;
      setDescription(loadedDescription);
      syncedForRef.current = syncKey;
    }
  }, [pageId, loadedDescription, revision]);

  const persist = useCallback(
    async (id: string, value: string) => {
      pendingRef.current = null;
      try {
        await updateMeta(id, { description: value });
      } catch (error) {
        onError?.(error);
      }
    },
    [updateMeta, onError],
  );

  const scheduleDescriptionSave = useCallback(
    (value: string) => {
      setDescription(value);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      pendingRef.current = value;
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        void persist(pageId, value);
      }, META_AUTOSAVE_DEBOUNCE_MS);
    },
    [pageId, persist],
  );

  const flushDescriptionSave = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingRef.current !== null) {
      await persist(pageId, pendingRef.current);
    }
  }, [pageId, persist]);

  // The cleanup closure captures the render it was created in — i.e. the Page
  // being navigated away from — so its pending write still reaches that Page.
  useEffect(() => {
    return () => {
      void flushDescriptionSave();
    };
  }, [flushDescriptionSave]);

  return { description, scheduleDescriptionSave, flushDescriptionSave };
}

/**
 * The emoji beside the title: one discrete action, so it saves immediately
 * instead of debounce-scheduling. A rejected write rolls the picker back to
 * the last value that actually persisted rather than leaving the UI showing
 * an emoji the database never took.
 */
export function usePageEmoji(pageId: string, loadedEmoji: string | null | undefined, onError?: (error: unknown) => void) {
  const updateMeta = useUpdatePageMeta();
  const [emoji, setEmoji] = useState(loadedEmoji ?? null);
  const syncedForRef = useRef<string | null>(null);
  const syncedEmojiRef = useRef<string | null>(loadedEmoji ?? null);
  const revision = useEditorRevision(pageId);

  useEffect(() => {
    const syncKey = `${pageId}:${revision}`;
    if (loadedEmoji !== undefined && syncedForRef.current !== syncKey) {
      syncedEmojiRef.current = loadedEmoji;
      setEmoji(loadedEmoji);
      syncedForRef.current = syncKey;
    }
  }, [pageId, loadedEmoji, revision]);

  const saveEmoji = useCallback(
    async (value: string | null) => {
      setEmoji(value);
      try {
        await updateMeta(pageId, { emoji: value });
        syncedEmojiRef.current = value;
      } catch (error) {
        setEmoji(syncedEmojiRef.current);
        onError?.(error);
      }
    },
    [pageId, updateMeta, onError],
  );

  return { emoji, saveEmoji };
}
