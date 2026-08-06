"use client";

import { useSyncExternalStore, useMemo } from "react";
import { spacesStore, pagesStore } from "@/lib/data-store";
import type { Page, Space } from "@/lib/types";

/** Publishable Spaces for an Organization, each with their published root+nested Pages — Flow 5 step 1. */
export function usePublicToc(organizationId: string | undefined) {
  const spaces = useSyncExternalStore(spacesStore.subscribe, spacesStore.getState, spacesStore.getState);
  const pages = useSyncExternalStore(pagesStore.subscribe, pagesStore.getState, pagesStore.getState);

  return useMemo(() => {
    if (!organizationId) return [];
    const orgSpaces = spaces.filter((s) => s.organizationId === organizationId && s.isPublishable);
    return orgSpaces
      .map((space) => ({
        space,
        pages: pages.filter((p) => p.spaceId === space.id && p.isPublished).sort((a, b) => a.order - b.order),
      }))
      .filter((entry) => entry.pages.length > 0);
  }, [spaces, pages, organizationId]);
}

/** A single published Page, scoped to its Organization — returns null if not published, not found, or belongs to a different Organization (never a fallback). */
export function usePublicPage(pageId: string | undefined, organizationId: string | undefined) {
  const pages = useSyncExternalStore(pagesStore.subscribe, pagesStore.getState, pagesStore.getState);
  const spaces = useSyncExternalStore(spacesStore.subscribe, spacesStore.getState, spacesStore.getState);

  return useMemo(() => {
    if (!pageId || !organizationId) return null;
    const page = pages.find((p) => p.id === pageId);
    if (!page || !page.isPublished || !page.publishedContentSnapshot) return null;
    const space = spaces.find((s) => s.id === page.spaceId);
    if (!space || space.organizationId !== organizationId || !space.isPublishable) return null;
    return { page, space } as { page: Page; space: Space };
  }, [pages, spaces, pageId, organizationId]);
}
