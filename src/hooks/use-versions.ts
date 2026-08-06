"use client";

import { useSyncExternalStore, useCallback } from "react";
import { versionsStore, pagesStore, nextId } from "@/lib/data-store";
import type { Version } from "@/lib/types";

export function usePageVersions(pageId: string | undefined) {
  const versions = useSyncExternalStore(versionsStore.subscribe, versionsStore.getState, versionsStore.getState);
  return pageId
    ? versions.filter((v) => v.pageId === pageId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    : [];
}

export function useCreateVersion() {
  return useCallback((pageId: string, title: string, content: Version["content"], createdByUserId: string, isRestoreOf: string | null = null) => {
    const version: Version = {
      id: nextId("version"),
      pageId,
      title,
      content,
      createdByUserId,
      createdAt: new Date().toISOString(),
      isRestoreOf,
    };
    versionsStore.setState((prev) => [...prev, version]);
    return version;
  }, []);
}

/** Restoring replaces the live draft AND logs a new version marking the restore — never destructive (Flow 9 step 3). */
export function useRestoreVersion() {
  return useCallback((pageId: string, versionId: string, restoredByUserId: string) => {
    const version = versionsStore.getState().find((v) => v.id === versionId);
    if (!version) return;
    pagesStore.setState((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, title: version.title, content: version.content, updatedAt: new Date().toISOString() } : p)),
    );
    versionsStore.setState((prev) => [
      ...prev,
      { id: nextId("version"), pageId, title: version.title, content: version.content, createdByUserId: restoredByUserId, createdAt: new Date().toISOString(), isRestoreOf: version.id },
    ]);
  }, []);
}
