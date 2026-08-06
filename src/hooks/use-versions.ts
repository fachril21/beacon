"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import { versionsStore, pagesStore } from "@/lib/supabase/stores";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapVersionRow, type VersionRow } from "@/lib/supabase/mappers";
import type { Version } from "@/lib/types";

export function usePageVersions(pageId: string | undefined) {
  const versions = useSyncExternalStore(versionsStore.subscribe, versionsStore.getState, versionsStore.getState);

  useEffect(() => {
    if (!pageId) return;
    versionsStore.ensureLoaded(
      `page:${pageId}`,
      async () => {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.from("versions").select("*").eq("page_id", pageId);
        if (error) throw error;
        return ((data ?? []) as VersionRow[]).map(mapVersionRow);
      },
      (error) => console.error("[beacon] failed to load versions:", error),
    );
  }, [pageId]);

  return pageId
    ? versions.filter((v) => v.pageId === pageId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    : [];
}

export function useCreateVersion() {
  return useCallback(
    async (
      pageId: string,
      title: string,
      content: Version["content"],
      createdByUserId: string,
      isRestoreOf: string | null = null,
    ): Promise<Version> => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("versions")
        .insert({ page_id: pageId, title, content, created_by_user_id: createdByUserId, is_restore_of: isRestoreOf })
        .select()
        .single();
      if (error) throw error;

      const version = mapVersionRow(data as VersionRow);
      versionsStore.setState((prev) => [...prev, version]);
      return version;
    },
    [],
  );
}

/** Restoring replaces the live draft AND logs a new version marking the restore — never destructive (Flow 9 step 3). */
export function useRestoreVersion() {
  return useCallback(async (pageId: string, versionId: string, restoredByUserId: string) => {
    const version = versionsStore.getState().find((v) => v.id === versionId);
    if (!version) return;

    const supabase = getSupabaseBrowserClient();

    const { error: pageError } = await supabase
      .from("pages")
      .update({ title: version.title, content: version.content })
      .eq("id", pageId);
    if (pageError) throw pageError;

    pagesStore.setState((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, title: version.title, content: version.content, updatedAt: new Date().toISOString() } : p)),
    );

    const { data, error: versionError } = await supabase
      .from("versions")
      .insert({
        page_id: pageId,
        title: version.title,
        content: version.content,
        created_by_user_id: restoredByUserId,
        is_restore_of: version.id,
      })
      .select()
      .single();
    if (versionError) throw versionError;

    versionsStore.setState((prev) => [...prev, mapVersionRow(data as VersionRow)]);
  }, []);
}
