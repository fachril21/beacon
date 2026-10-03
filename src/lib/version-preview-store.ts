"use client";

/**
 * The Version History entry currently being previewed, per Page. While one
 * is set, the main editor column shows that old version read-only (like
 * Figma's version history) and the live editor and title are locked — the
 * only ways out are the panel's "Kembali" button, a restore, or the panel
 * going away.
 */
import { useSyncExternalStore } from "react";
import { createStore } from "@/lib/store";
import type { Version } from "@/lib/types";

const previewStore = createStore<Readonly<Record<string, Version>>>({});

export function setVersionPreview(pageId: string, version: Version | null): void {
  previewStore.setState((prev) => {
    if (version === null) {
      if (!(pageId in prev)) return prev;
      const next = { ...prev };
      delete next[pageId];
      return next;
    }
    return { ...prev, [pageId]: version };
  });
}

export function useVersionPreview(pageId: string): Version | null {
  return useSyncExternalStore(
    previewStore.subscribe,
    () => previewStore.getState()[pageId] ?? null,
    () => null,
  );
}

export function useIsVersionPreviewing(pageId: string): boolean {
  return useVersionPreview(pageId) !== null;
}
