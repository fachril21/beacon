"use client";

import { useSyncExternalStore, useCallback, useEffect, useRef } from "react";
import { versionsStore, pagesStore } from "@/lib/supabase/stores";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapVersionRow, type VersionRow } from "@/lib/supabase/mappers";
import { useSession } from "@/hooks/use-session";
import { clearPendingEdit } from "@/lib/offline-buffer";
import { bumpEditorRevision } from "@/lib/editor-revision-store";
import { extractPlainText } from "@/lib/extract-text";
import { isSameAsVersion, shouldSnapshot, VERSION_SNAPSHOT_INTERVAL_MS } from "@/lib/version-snapshot";
import type { PageContent, Version } from "@/lib/types";

/** How many of a Page's newest versions the history panel loads. */
const VERSION_LIST_LIMIT = 50;

async function fetchVersions(pageId: string, limit: number): Promise<Version[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("versions")
    .select("*")
    .eq("page_id", pageId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as VersionRow[]).map(mapVersionRow);
}

export function usePageVersions(pageId: string | undefined) {
  const versions = useSyncExternalStore(versionsStore.subscribe, versionsStore.getState, versionsStore.getState);

  useEffect(() => {
    if (!pageId) return;
    versionsStore.ensureLoaded(
      `page:${pageId}`,
      () => fetchVersions(pageId, VERSION_LIST_LIMIT),
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

/**
 * Returns a `snapshot(title, content)` the editor calls after every
 * successful autosave. History reads like a timeline of the page:
 *
 *  - the first version is the page as it was BEFORE the first edit
 *    (`baseline`, captured when the editor mounted), so the oldest entry
 *    really is the original, not the first autosave;
 *  - after that, one version per VERSION_SNAPSHOT_INTERVAL_MS at most, and
 *    never one identical to the newest;
 *  - an edit that arrives inside the interval is not dropped: it is kept as
 *    pending and recorded when the interval ends, or immediately if the
 *    editor unmounts first, so the newest state always ends up in history.
 *
 * It never throws — a failed history write must not look like a failed save.
 */
export function useVersionSnapshots(pageId: string, baseline?: { title: string; content: PageContent }) {
  const createVersion = useCreateVersion();
  const { user } = useSession();
  const userId = user?.id;
  // undefined = not fetched yet; null = fetched, Page has no versions.
  const latestRef = useRef<Version | null | undefined>(undefined);
  const baselineRef = useRef(baseline ?? null);
  const pendingRef = useRef<{ title: string; content: PageContent } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBusyRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const runRef = useRef<(title: string, content: PageContent, force: boolean) => Promise<void>>(async () => {});

  const run = useCallback(
    async (title: string, content: PageContent, force: boolean): Promise<void> => {
      if (!userId) return;
      if (isBusyRef.current) {
        pendingRef.current = { title, content };
        return;
      }
      isBusyRef.current = true;
      try {
        if (latestRef.current === undefined) {
          latestRef.current = (await fetchVersions(pageId, 1))[0] ?? null;
        }
        const original = baselineRef.current;
        baselineRef.current = null;
        if (latestRef.current === null && original && !isSameAsVersion(original, title, content)) {
          latestRef.current = await createVersion(pageId, original.title, original.content, userId);
        }

        const latest = latestRef.current;
        const isDuplicate = isSameAsVersion(latest, title, content);
        if (isDuplicate || (!force && !shouldSnapshot(latest, title, content, Date.now()))) {
          if (!isDuplicate && latest) {
            const remaining = Math.max(0, VERSION_SNAPSHOT_INTERVAL_MS - (Date.now() - Date.parse(latest.createdAt)));
            pendingRef.current = { title, content };
            clearTimer();
            timerRef.current = setTimeout(() => {
              const pending = pendingRef.current;
              if (pending) void runRef.current(pending.title, pending.content, false);
            }, remaining + 50);
          } else if (isDuplicate) {
            pendingRef.current = null;
            clearTimer();
          }
          return;
        }

        pendingRef.current = null;
        clearTimer();
        latestRef.current = await createVersion(pageId, title, content, userId);
      } catch (error) {
        console.error("[beacon] failed to record a version snapshot:", error);
      } finally {
        isBusyRef.current = false;
      }
    },
    [pageId, userId, createVersion, clearTimer],
  );

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  // Leaving the editor: record the newest throttled edit now instead of losing it.
  useEffect(() => {
    return () => {
      clearTimer();
      const pending = pendingRef.current;
      if (pending) void runRef.current(pending.title, pending.content, true);
    };
  }, [clearTimer]);

  return useCallback((title: string, content: PageContent) => run(title, content, false), [run]);
}

/**
 * Restoring replaces the live draft AND logs a new version marking the
 * restore — never destructive (Flow 9 step 3). The current draft is first
 * saved as its own version (unless identical to the newest one) so even the
 * pre-restore state stays recoverable. Throws on failure; the editor is only
 * reloaded once the page row has actually been replaced.
 */
export function useRestoreVersion() {
  return useCallback(async (pageId: string, versionId: string, restoredByUserId: string) => {
    const pageVersions = versionsStore.getState().filter((v) => v.pageId === pageId);
    const version = pageVersions.find((v) => v.id === versionId);
    if (!version) throw new Error("Versi tidak ditemukan.");

    const supabase = getSupabaseBrowserClient();
    const insertVersion = async (title: string, content: PageContent, isRestoreOf: string | null) => {
      const { data, error } = await supabase
        .from("versions")
        .insert({ page_id: pageId, title, content, created_by_user_id: restoredByUserId, is_restore_of: isRestoreOf })
        .select()
        .single();
      if (error) throw error;
      const created = mapVersionRow(data as VersionRow);
      versionsStore.setState((prev) => [...prev, created]);
    };

    const current = pagesStore.getState().find((p) => p.id === pageId);
    const newest = [...pageVersions].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
    if (current && !isSameAsVersion(newest, current.title, current.content)) {
      await insertVersion(current.title, current.content, null);
    }

    const { error: pageError } = await supabase
      .from("pages")
      .update({ title: version.title, content: version.content, search_text: extractPlainText(version.content) })
      .eq("id", pageId);
    if (pageError) throw pageError;

    pagesStore.setState((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, title: version.title, content: version.content, updatedAt: new Date().toISOString() } : p)),
    );

    await insertVersion(version.title, version.content, version.id);

    // A buffered offline edit would overwrite the restore on the next flush;
    // the remount drops the editor's pending debounce and shows the new content.
    await clearPendingEdit(pageId);
    bumpEditorRevision(pageId);
  }, []);
}
