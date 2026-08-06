"use client";

import { useMemo } from "react";
import { useSyncExternalStore } from "react";
import { pagesStore, spacesStore, permissionsStore } from "@/lib/data-store";
import { extractPlainText, snippetAround } from "@/lib/extract-text";
import type { SearchResult } from "@/lib/types";

function matches(haystack: string, query: string) {
  return haystack.toLowerCase().includes(query.toLowerCase());
}

/**
 * Internal search — scoped to Spaces the User has an explicit Permission row
 * in (mirrors what RLS will enforce in Stage 2, PRD.md §5.5).
 */
export function useInternalSearch(query: string, userId: string | undefined): SearchResult[] {
  const pages = useSyncExternalStore(pagesStore.subscribe, pagesStore.getState, pagesStore.getState);
  const spaces = useSyncExternalStore(spacesStore.subscribe, spacesStore.getState, spacesStore.getState);
  const permissions = useSyncExternalStore(permissionsStore.subscribe, permissionsStore.getState, permissionsStore.getState);

  return useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed || !userId) return [];
    const accessibleSpaceIds = new Set(permissions.filter((p) => p.userId === userId).map((p) => p.spaceId));
    const results: SearchResult[] = [];
    for (const page of pages) {
      if (!accessibleSpaceIds.has(page.spaceId)) continue;
      const space = spaces.find((s) => s.id === page.spaceId);
      if (!space) continue;
      const bodyText = extractPlainText(page.content);
      const titleHit = matches(page.title, trimmed);
      const bodyHit = matches(bodyText, trimmed);
      if (!titleHit && !bodyHit) continue;
      results.push({
        pageId: page.id,
        spaceId: space.id,
        spaceName: space.name,
        pageTitle: page.title,
        snippet: titleHit ? snippetAround(bodyText, "") : snippetAround(bodyText, trimmed),
      });
    }
    return results;
  }, [pages, spaces, permissions, query, userId]);
}

/**
 * Public search — anonymous, scoped to one Organization's publishable Spaces
 * and published Pages only (PRD.md §5.5, Flow 5).
 */
export function usePublicSearch(query: string, organizationId: string | undefined): SearchResult[] {
  const pages = useSyncExternalStore(pagesStore.subscribe, pagesStore.getState, pagesStore.getState);
  const spaces = useSyncExternalStore(spacesStore.subscribe, spacesStore.getState, spacesStore.getState);

  return useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed || !organizationId) return [];
    const publishableSpaceIds = new Set(
      spaces.filter((s) => s.organizationId === organizationId && s.isPublishable).map((s) => s.id),
    );
    const results: SearchResult[] = [];
    for (const page of pages) {
      if (!page.isPublished || !page.publishedContentSnapshot) continue;
      if (!publishableSpaceIds.has(page.spaceId)) continue;
      const space = spaces.find((s) => s.id === page.spaceId);
      if (!space) continue;
      const snapshot = page.publishedContentSnapshot;
      const bodyText = extractPlainText(snapshot.content);
      const titleHit = matches(snapshot.title, trimmed);
      const bodyHit = matches(bodyText, trimmed);
      if (!titleHit && !bodyHit) continue;
      results.push({
        pageId: page.id,
        spaceId: space.id,
        spaceName: space.name,
        pageTitle: snapshot.title,
        snippet: titleHit ? snippetAround(bodyText, "") : snippetAround(bodyText, trimmed),
      });
    }
    return results;
  }, [pages, spaces, query, organizationId]);
}
