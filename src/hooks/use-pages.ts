"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import { pagesStore } from "@/lib/supabase/stores";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapPageRow, type PageRow } from "@/lib/supabase/mappers";
import { emptyDoc } from "@/lib/mock/lexical-content";
import type { Page } from "@/lib/types";
import type { SerializedEditorState } from "lexical";

export function usePages(spaceId?: string) {
  const pages = useSyncExternalStore(pagesStore.subscribe, pagesStore.getState, pagesStore.getState);

  useEffect(() => {
    if (!spaceId) return;
    pagesStore.ensureLoaded(
      `space:${spaceId}`,
      async () => {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.from("pages").select("*").eq("space_id", spaceId);
        if (error) throw error;
        return ((data ?? []) as PageRow[]).map(mapPageRow);
      },
      (error) => console.error("[beacon] failed to load pages:", error),
    );
  }, [spaceId]);

  const scoped = spaceId ? pages.filter((p) => p.spaceId === spaceId) : pages;
  return [...scoped].sort((a, b) => a.order - b.order);
}

export function usePage(id: string | undefined) {
  const pages = useSyncExternalStore(pagesStore.subscribe, pagesStore.getState, pagesStore.getState);

  useEffect(() => {
    if (!id) return;
    pagesStore.ensureLoaded(`page:${id}`, async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from("pages").select("*").eq("id", id).single();
      if (error) throw error;
      return [mapPageRow(data as PageRow)];
    });
  }, [id]);

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
  return useCallback(async (input: CreatePageInput): Promise<Page> => {
    const supabase = getSupabaseBrowserClient();

    let siblingsQuery = supabase
      .from("pages")
      .select("*", { count: "exact", head: true })
      .eq("space_id", input.spaceId);
    siblingsQuery =
      input.parentPageId === null
        ? siblingsQuery.is("parent_page_id", null)
        : siblingsQuery.eq("parent_page_id", input.parentPageId);
    const { count, error: countError } = await siblingsQuery;
    if (countError) throw countError;

    const { data, error } = await supabase
      .from("pages")
      .insert({
        space_id: input.spaceId,
        parent_page_id: input.parentPageId,
        title: input.title,
        order: count ?? 0,
        content: emptyDoc(),
        visibility: "internal",
        is_published: false,
        created_by_user_id: input.createdByUserId,
      })
      .select()
      .single();
    if (error) throw error;

    const page = mapPageRow(data as PageRow);
    pagesStore.setState((prev) => [...prev, page]);
    return page;
  }, []);
}

export function useUpdatePageTitle() {
  return useCallback(async (id: string, title: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("pages").update({ title }).eq("id", id);
    if (error) throw error;

    pagesStore.setState((prev) => prev.map((p) => (p.id === id ? { ...p, title, updatedAt: new Date().toISOString() } : p)));
  }, []);
}

export function useUpdatePageContent() {
  return useCallback(async (id: string, content: SerializedEditorState) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("pages").update({ content }).eq("id", id);
    if (error) throw error;

    pagesStore.setState((prev) => prev.map((p) => (p.id === id ? { ...p, content, updatedAt: new Date().toISOString() } : p)));
  }, []);
}

/** Reorders siblings under the same parent — used by sidebar drag-and-drop (Epic 3 US3.2). */
export function useReorderPages() {
  return useCallback(async (spaceId: string, parentPageId: string | null, orderedIds: string[]) => {
    const supabase = getSupabaseBrowserClient();
    await Promise.all(
      orderedIds.map((id, order) => supabase.from("pages").update({ order }).eq("id", id)),
    );

    pagesStore.setState((prev) =>
      prev.map((p) => {
        if (p.spaceId !== spaceId || p.parentPageId !== parentPageId) return p;
        const order = orderedIds.indexOf(p.id);
        return order === -1 ? p : { ...p, order };
      }),
    );
  }, []);
}

/**
 * Publish/Update/Unpublish (Flow 4) each call a single Postgres RPC
 * (20260806100200_publishing_rpcs.sql) that sets is_published and
 * published_content_snapshot together, atomically — a Viewer can never
 * observe one changed without the other. The RPC runs as the calling User
 * (SECURITY INVOKER), so the same pages_update_editor RLS policy that
 * gates a direct UPDATE gates this too.
 */
export function usePublishActions() {
  async function callPublishRpc(name: "publish_page" | "update_published_page" | "unpublish_page", id: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc(name, { p_page_id: id });
    if (error) throw error;

    const page = mapPageRow(data as PageRow);
    pagesStore.setState((prev) => prev.map((p) => (p.id === id ? page : p)));
    return page;
  }

  const publish = useCallback((id: string) => callPublishRpc("publish_page", id), []);
  const update = useCallback((id: string) => callPublishRpc("update_published_page", id), []);
  const unpublish = useCallback((id: string) => callPublishRpc("unpublish_page", id), []);

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
