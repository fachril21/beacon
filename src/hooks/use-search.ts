"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { snippetAround } from "@/lib/extract-text";
import type { SearchResult } from "@/lib/types";

const SEARCH_DEBOUNCE_MS = 250;

interface PageSearchRow {
  id: string;
  space_id: string;
  title: string;
  is_published: boolean;
  published_content_snapshot: { title: string } | null;
  search_text: string;
  spaces: { name: string; organization_id?: string; is_publishable?: boolean } | null;
}

function useDebounced(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Internal search — RLS ("authenticated" role) naturally scopes results to
 * Spaces the caller has a Permission row in, plus anything already public,
 * mirroring PRD.md §5.5's "internal + published" and Flow 6.
 */
export function useInternalSearch(query: string, userId: string | undefined): SearchResult[] {
  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed || !userId) return;
    let cancelled = false;

    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("pages")
        .select("id, space_id, title, is_published, published_content_snapshot, search_text, spaces(name)")
        .textSearch("search_vector", trimmed, { type: "websearch", config: "simple" });
      if (error) {
        console.error("[beacon] internal search failed:", error);
        return;
      }
      const rows = (data ?? []) as unknown as PageSearchRow[];
      const mapped: SearchResult[] = rows
        .filter((row) => row.spaces)
        .map((row) => ({
          pageId: row.id,
          spaceId: row.space_id,
          spaceName: row.spaces!.name,
          pageTitle: row.title,
          snippet: snippetAround(row.search_text, trimmed),
        }));
      if (!cancelled) setResults(mapped);
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, userId]);

  return debouncedQuery.trim() && userId ? results : [];
}

/**
 * Public search — anonymous, explicitly scoped to one Organization's
 * publishable Spaces and published Pages only (PRD.md §5.5, Flow 5). RLS's
 * pages_select_public_published policy already gates is_published/
 * visibility/space.is_publishable; the organization_id check here is the
 * same app-level scoping use-public-content.ts relies on until Epic 14a's
 * Host-header middleware lands.
 */
export function usePublicSearch(query: string, organizationId: string | undefined): SearchResult[] {
  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed || !organizationId) return;
    let cancelled = false;

    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("pages")
        .select("id, space_id, title, is_published, published_content_snapshot, search_text, spaces(name, organization_id, is_publishable)")
        .textSearch("search_vector", trimmed, { type: "websearch", config: "simple" });
      if (error) {
        console.error("[beacon] public search failed:", error);
        return;
      }
      const rows = (data ?? []) as unknown as PageSearchRow[];
      const mapped: SearchResult[] = rows
        .filter(
          (row) =>
            row.is_published &&
            row.published_content_snapshot &&
            row.spaces?.organization_id === organizationId &&
            row.spaces.is_publishable,
        )
        .map((row) => ({
          pageId: row.id,
          spaceId: row.space_id,
          spaceName: row.spaces!.name,
          pageTitle: row.published_content_snapshot!.title,
          snippet: snippetAround(row.search_text, trimmed),
        }));
      if (!cancelled) setResults(mapped);
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, organizationId]);

  return debouncedQuery.trim() && organizationId ? results : [];
}
