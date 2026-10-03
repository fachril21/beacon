"use client";

/**
 * Per-Page counter bumped whenever the Page's content is replaced from
 * outside the editor (a Version restore). BlockNote owns its document state
 * after mount, so the only way to make it show restored content — and to
 * drop its pending autosave — is to remount it; PageEditor and the title
 * input key off this revision for exactly that.
 */
import { useSyncExternalStore } from "react";
import { createStore } from "@/lib/store";

const revisionStore = createStore<Record<string, number>>({});

export function getEditorRevision(pageId: string): number {
  return revisionStore.getState()[pageId] ?? 0;
}

export function bumpEditorRevision(pageId: string): void {
  revisionStore.setState((prev) => ({ ...prev, [pageId]: (prev[pageId] ?? 0) + 1 }));
}

export function useEditorRevision(pageId: string): number {
  return useSyncExternalStore(
    revisionStore.subscribe,
    () => getEditorRevision(pageId),
    () => 0,
  );
}
