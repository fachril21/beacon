"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapSpaceRow, mapPageRow, type SpaceRow, type PageRow } from "@/lib/supabase/mappers";
import type { Page, Space } from "@/lib/types";

/**
 * Publishable Spaces for an Organization, each with their published Pages —
 * Flow 5 step 1. Explicitly scoped by organizationId at the query level (not
 * just RLS, which only knows visibility/is_published — Organization scoping
 * is Epic 14a's Host-header middleware, not yet wired, so this hook is what
 * currently prevents cross-Organization leakage in the public site).
 */
export function usePublicToc(organizationId: string | undefined) {
  const [entries, setEntries] = useState<{ space: Space; pages: Page[] }[]>([]);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;

    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: spaceRows, error: spaceError } = await supabase
        .from("spaces")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_publishable", true);
      if (spaceError) {
        console.error("[beacon] failed to load public spaces:", spaceError);
        return;
      }
      const spaces = ((spaceRows ?? []) as SpaceRow[]).map(mapSpaceRow);
      if (spaces.length === 0) {
        if (!cancelled) setEntries([]);
        return;
      }

      const { data: pageRows, error: pageError } = await supabase
        .from("pages")
        .select("*")
        .in(
          "space_id",
          spaces.map((s) => s.id),
        )
        .eq("is_published", true);
      if (pageError) {
        console.error("[beacon] failed to load public pages:", pageError);
        return;
      }
      const pages = ((pageRows ?? []) as PageRow[]).map(mapPageRow);

      const result = spaces
        .map((space) => ({
          space,
          pages: pages.filter((p) => p.spaceId === space.id).sort((a, b) => a.order - b.order),
        }))
        .filter((entry) => entry.pages.length > 0);

      if (!cancelled) setEntries(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return organizationId ? entries : [];
}

/** A single published Page, scoped to its Organization — returns null if not published, not found, or belongs to a different Organization (never a fallback). */
export function usePublicPage(pageId: string | undefined, organizationId: string | undefined) {
  const [result, setResult] = useState<{ page: Page; space: Space } | null>(null);

  useEffect(() => {
    if (!pageId || !organizationId) return;
    let cancelled = false;

    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: pageRow, error: pageError } = await supabase
        .from("pages")
        .select("*")
        .eq("id", pageId)
        .single();
      if (pageError || !pageRow) {
        if (!cancelled) setResult(null);
        return;
      }
      const page = mapPageRow(pageRow as PageRow);
      if (!page.isPublished || !page.publishedContentSnapshot) {
        if (!cancelled) setResult(null);
        return;
      }

      const { data: spaceRow, error: spaceError } = await supabase
        .from("spaces")
        .select("*")
        .eq("id", page.spaceId)
        .single();
      if (spaceError || !spaceRow) {
        if (!cancelled) setResult(null);
        return;
      }
      const space = mapSpaceRow(spaceRow as SpaceRow);
      if (space.organizationId !== organizationId || !space.isPublishable) {
        if (!cancelled) setResult(null);
        return;
      }

      if (!cancelled) setResult({ page, space });
    })();

    return () => {
      cancelled = true;
    };
  }, [pageId, organizationId]);

  return pageId && organizationId ? result : null;
}
