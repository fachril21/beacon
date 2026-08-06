"use client";

import { useSyncExternalStore, useCallback } from "react";
import { pagesStore, nextId } from "@/lib/data-store";
import { emptyDoc } from "@/lib/mock/lexical-content";
import type { Page } from "@/lib/types";
import type { SerializedEditorState } from "lexical";

export function usePages(spaceId?: string) {
  const pages = useSyncExternalStore(pagesStore.subscribe, pagesStore.getState, pagesStore.getState);
  const scoped = spaceId ? pages.filter((p) => p.spaceId === spaceId) : pages;
  return [...scoped].sort((a, b) => a.order - b.order);
}

export function usePage(id: string | undefined) {
  const pages = useSyncExternalStore(pagesStore.subscribe, pagesStore.getState, pagesStore.getState);
  return id ? pages.find((p) => p.id === id) : undefined;
}

/** Direct children of a given parent within a Space, ordered for sidebar rendering (Flow 2 step 5). */
export function useChildPages(spaceId: string, parentPageId: string | null) {
  const pages = usePages(spaceId);
  return pages.filter((p) => p.parentPageId === parentPageId);
}

export interface CreatePageInput {
  spaceId: string;
  parentPageId: string | null;
  title: string;
  createdByUserId: string;
}

export function useCreatePage() {
  return useCallback((input: CreatePageInput): Page => {
    const siblings = pagesStore.getState().filter((p) => p.spaceId === input.spaceId && p.parentPageId === input.parentPageId);
    const now = new Date().toISOString();
    const page: Page = {
      id: nextId("page"),
      spaceId: input.spaceId,
      parentPageId: input.parentPageId,
      title: input.title,
      order: siblings.length,
      content: emptyDoc(),
      visibility: "internal",
      isPublished: false,
      publishedContentSnapshot: null,
      publishedAt: null,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
    };
    pagesStore.setState((prev) => [...prev, page]);
    return page;
  }, []);
}

export function useUpdatePageTitle() {
  return useCallback((id: string, title: string) => {
    pagesStore.setState((prev) => prev.map((p) => (p.id === id ? { ...p, title, updatedAt: new Date().toISOString() } : p)));
  }, []);
}

export function useUpdatePageContent() {
  return useCallback((id: string, content: SerializedEditorState) => {
    pagesStore.setState((prev) => prev.map((p) => (p.id === id ? { ...p, content, updatedAt: new Date().toISOString() } : p)));
  }, []);
}

/** Reorders siblings under the same parent — used by sidebar drag-and-drop (Epic 3 US3.2). */
export function useReorderPages() {
  return useCallback((spaceId: string, parentPageId: string | null, orderedIds: string[]) => {
    pagesStore.setState((prev) =>
      prev.map((p) => {
        if (p.spaceId !== spaceId || p.parentPageId !== parentPageId) return p;
        const order = orderedIds.indexOf(p.id);
        return order === -1 ? p : { ...p, order };
      }),
    );
  }, []);
}

export function usePublishActions() {
  const publish = useCallback((id: string) => {
    pagesStore.setState((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const publishedAt = new Date().toISOString();
        return {
          ...p,
          isPublished: true,
          publishedAt,
          publishedContentSnapshot: { title: p.title, content: p.content, screenshotBlocks: {}, publishedAt },
        };
      }),
    );
  }, []);

  const update = useCallback((id: string) => {
    pagesStore.setState((prev) =>
      prev.map((p) => {
        if (p.id !== id || !p.isPublished) return p;
        const publishedAt = new Date().toISOString();
        return { ...p, publishedAt, publishedContentSnapshot: { title: p.title, content: p.content, screenshotBlocks: {}, publishedAt } };
      }),
    );
  }, []);

  const unpublish = useCallback((id: string) => {
    pagesStore.setState((prev) => prev.map((p) => (p.id === id ? { ...p, isPublished: false } : p)));
  }, []);

  return { publish, update, unpublish };
}

/** Whether a Page's draft has diverged from its last published snapshot (Flow 4 step 4). */
export function hasUnpublishedChanges(page: Page): boolean {
  if (!page.isPublished || !page.publishedContentSnapshot) return false;
  return (
    page.title !== page.publishedContentSnapshot.title ||
    JSON.stringify(page.content) !== JSON.stringify(page.publishedContentSnapshot.content)
  );
}

export function getPageStatus(page: Page): "draft" | "published" | "pending" {
  if (!page.isPublished) return "draft";
  return hasUnpublishedChanges(page) ? "pending" : "published";
}
