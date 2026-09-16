"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapSpaceRow, mapPageRow, type SpaceRow, type PageRow } from "@/lib/supabase/mappers";
import { buildPageTree, type PageTreeNode } from "@/lib/build-page-tree";
import type { Page, Space } from "@/lib/types";

/**
 * The publishable Spaces of an Organization that have at least one published
 * Page — the public site home is a directory of these (per-Space publishing,
 * not one merged page list). Explicitly scoped by organizationId at the query
 * level, same as every other hook here, since Epic 14a's Host-header
 * middleware only sets a header and does not yet filter queries.
 */
export function usePublicSpaces(organizationId: string | undefined) {
  const [spaces, setSpaces] = useState<{ space: Space; publishedPageCount: number }[]>([]);

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
      const allSpaces = ((spaceRows ?? []) as SpaceRow[]).map(mapSpaceRow);
      if (allSpaces.length === 0) {
        if (!cancelled) setSpaces([]);
        return;
      }

      const { data: pageRows, error: pageError } = await supabase
        .from("pages")
        .select("space_id")
        .in(
          "space_id",
          allSpaces.map((s) => s.id),
        )
        .eq("is_published", true);
      if (pageError) {
        console.error("[beacon] failed to count public pages:", pageError);
        return;
      }

      const countBySpaceId = new Map<string, number>();
      for (const row of (pageRows ?? []) as { space_id: string }[]) {
        countBySpaceId.set(row.space_id, (countBySpaceId.get(row.space_id) ?? 0) + 1);
      }

      const result = allSpaces
        .map((space) => ({ space, publishedPageCount: countBySpaceId.get(space.id) ?? 0 }))
        .filter((entry) => entry.publishedPageCount > 0);

      if (!cancelled) setSpaces(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return organizationId ? spaces : [];
}

/**
 * The single Space the visitor is currently browsing on the public site, with
 * only that Space's published Page tree — never a merge across Spaces:
 *
 *   /public/{org}/spaces/{spaceSlug}   -> that Space (by slug)
 *   /public/{org}/pages/{pageSlug}     -> the published Page's own Space
 *   /public/{org}  (directory)         -> null
 *
 * Resolved here (once, in the layout shell) so the sidebar TOC and the
 * space-scoped search don't each have to re-derive it from whichever child
 * route happens to be mounted. Returns null — never a fallback to another
 * Space — when the slug matches nothing publishable (Flow 5).
 */
export function usePublicCurrentSpace(organizationId: string | undefined) {
  const params = useParams<{ spaceSlug?: string; pageSlug?: string }>();
  const spaceSlug = typeof params?.spaceSlug === "string" ? params.spaceSlug : null;
  const pageSlug = typeof params?.pageSlug === "string" ? params.pageSlug : null;

  const [result, setResult] = useState<{ space: Space; pages: PageTreeNode[] } | null>(null);

  useEffect(() => {
    // No current Space on the directory route — the return expression below
    // already yields null there, so nothing to set (and a synchronous
    // setState in an effect guard is a lint error / cascading render).
    if (!organizationId || (!spaceSlug && !pageSlug)) return;
    let cancelled = false;

    (async () => {
      const supabase = getSupabaseBrowserClient();

      let spaceRow: SpaceRow | null = null;

      if (spaceSlug) {
        const { data, error } = await supabase
          .from("spaces")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("slug", spaceSlug)
          .eq("is_publishable", true)
          .single();
        if (error || !data) {
          if (!cancelled) setResult(null);
          return;
        }
        spaceRow = data as SpaceRow;
      } else {
        const { data: pageLookup, error: pageLookupError } = await supabase
          .from("pages")
          .select("space_id")
          .eq("organization_id", organizationId)
          .eq("slug", pageSlug)
          .single();
        if (pageLookupError || !pageLookup) {
          if (!cancelled) setResult(null);
          return;
        }
        const { data, error } = await supabase
          .from("spaces")
          .select("*")
          .eq("id", (pageLookup as { space_id: string }).space_id)
          .eq("is_publishable", true)
          .single();
        if (error || !data) {
          if (!cancelled) setResult(null);
          return;
        }
        spaceRow = data as SpaceRow;
      }

      const space = mapSpaceRow(spaceRow);
      if (space.organizationId !== organizationId) {
        if (!cancelled) setResult(null);
        return;
      }

      const { data: pageRows, error: pageError } = await supabase
        .from("pages")
        .select("*")
        .eq("space_id", space.id)
        .eq("is_published", true);
      if (pageError) {
        console.error("[beacon] failed to load public space pages:", pageError);
        return;
      }
      const pages = buildPageTree(((pageRows ?? []) as PageRow[]).map(mapPageRow));

      if (!cancelled) setResult({ space, pages });
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, spaceSlug, pageSlug]);

  return organizationId && (spaceSlug || pageSlug) ? result : null;
}

/**
 * A single published Page, looked up by its slug scoped to its Organization
 * (slugs are unique per-Organization, not globally — see
 * pages_organization_id_slug_unique) — returns null if not published, not
 * found, or belongs to a different Organization (never a fallback).
 */
export function usePublicPage(pageSlug: string | undefined, organizationId: string | undefined) {
  const [result, setResult] = useState<{ page: Page; space: Space } | null>(null);

  useEffect(() => {
    if (!pageSlug || !organizationId) return;
    let cancelled = false;

    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: pageRow, error: pageError } = await supabase
        .from("pages")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("slug", pageSlug)
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
  }, [pageSlug, organizationId]);

  return pageSlug && organizationId ? result : null;
}
