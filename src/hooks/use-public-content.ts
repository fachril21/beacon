"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapSpaceRow, mapPageRow, type SpaceRow, type PageRow } from "@/lib/supabase/mappers";
import { buildPageTree, type PageTreeNode } from "@/lib/build-page-tree";
import type { Page, Space } from "@/lib/types";

export interface PublicRecentPage {
  title: string;
  slug: string;
  publishedAt: string;
}

/** A public lookup's three real states — "not found" must never be inferred from an in-flight request. */
export type PublicLookupStatus = "loading" | "ready" | "not-found";

export type PublicLookup<T> =
  | { status: "loading"; data: null }
  | { status: "not-found"; data: null }
  | { status: "ready"; data: T };

export interface PublicSpacePageTree {
  space: Space;
  pages: PageTreeNode[];
}

export interface PublicPageResult {
  page: Page;
  space: Space;
}

/**
 * Keyed resolution state: `key` identifies the request whose result this is.
 * While the current request's key doesn't match, the caller renders the
 * loading state — so navigating from one Page/Space to another never flashes
 * a stale result (or a false "not found") before the new query settles.
 */
type ResolvedState<T> =
  | { key: string; status: "ready"; data: T }
  | { key: string; status: "not-found"; data: null };

interface PublicSpacesState {
  key: string;
  spaces: { space: Space; publishedPageCount: number }[];
  recentPages: PublicRecentPage[];
}

/**
 * The publishable Spaces of an Organization that have at least one published
 * Page — the public site home is a directory of these (per-Space publishing,
 * not one merged page list) — plus the 4 most recently published page titles
 * across all of them, for the home hero's "Terbaru:" chip row (wireframe v2
 * §3.5; explicitly not called "Populer" since it's recency, not traffic).
 * Both are derived from the same published-pages query, so this doesn't add
 * a second round trip. Explicitly scoped by organizationId at the query
 * level, same as every other hook here, since Epic 14a's Host-header
 * middleware only sets a header and does not yet filter queries.
 */
export function usePublicSpaces(organizationId: string | undefined) {
  const [state, setState] = useState<PublicSpacesState | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;

    const finish = (spaces: PublicSpacesState["spaces"], recentPages: PublicRecentPage[]) => {
      if (!cancelled) setState({ key: organizationId, spaces, recentPages });
    };

    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: spaceRows, error: spaceError } = await supabase
        .from("spaces")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("is_publishable", true);
      if (spaceError) {
        console.error("[beacon] failed to load public spaces:", spaceError);
        finish([], []);
        return;
      }
      const allSpaces = ((spaceRows ?? []) as SpaceRow[]).map(mapSpaceRow);
      if (allSpaces.length === 0) {
        finish([], []);
        return;
      }

      const { data: pageRows, error: pageError } = await supabase
        .from("pages")
        .select("space_id, title, slug, published_at")
        .in(
          "space_id",
          allSpaces.map((s) => s.id),
        )
        .eq("is_published", true);
      if (pageError) {
        console.error("[beacon] failed to count public pages:", pageError);
        finish([], []);
        return;
      }

      const publishedPages = (pageRows ?? []) as { space_id: string; title: string; slug: string | null; published_at: string | null }[];

      const countBySpaceId = new Map<string, number>();
      for (const row of publishedPages) {
        countBySpaceId.set(row.space_id, (countBySpaceId.get(row.space_id) ?? 0) + 1);
      }

      const result = allSpaces
        .map((space) => ({ space, publishedPageCount: countBySpaceId.get(space.id) ?? 0 }))
        .filter((entry) => entry.publishedPageCount > 0);

      const recent = publishedPages
        .filter((row): row is { space_id: string; title: string; slug: string; published_at: string } => Boolean(row.slug && row.published_at))
        .sort((a, b) => (a.published_at < b.published_at ? 1 : -1))
        .slice(0, 4)
        .map((row) => ({ title: row.title, slug: row.slug, publishedAt: row.published_at }));

      finish(result, recent);
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (!organizationId) return { spaces: [], recentPages: [], isLoading: false };
  if (!state || state.key !== organizationId) return { spaces: [], recentPages: [], isLoading: true };
  return { spaces: state.spaces, recentPages: state.recentPages, isLoading: false };
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
 * route happens to be mounted. Returns "not-found" — never a fallback to
 * another Space — when the slug matches nothing publishable (Flow 5), and
 * "loading" while the lookup is still in flight.
 */
export function usePublicCurrentSpace(organizationId: string | undefined): PublicLookup<PublicSpacePageTree> {
  const params = useParams<{ spaceSlug?: string; pageSlug?: string }>();
  const spaceSlug = typeof params?.spaceSlug === "string" ? params.spaceSlug : null;
  const pageSlug = typeof params?.pageSlug === "string" ? params.pageSlug : null;
  const requestKey =
    organizationId && (spaceSlug || pageSlug)
      ? `${organizationId}|${spaceSlug ?? ""}|${pageSlug ?? ""}`
      : null;

  const [state, setState] = useState<ResolvedState<PublicSpacePageTree> | null>(null);

  useEffect(() => {
    // No current Space on the directory route — the return expression below
    // already reports not-found there, so nothing to fetch.
    if (!requestKey || !organizationId) return;
    let cancelled = false;

    const notFound = () => {
      if (!cancelled) setState({ key: requestKey, status: "not-found", data: null });
    };

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
          notFound();
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
          notFound();
          return;
        }
        const { data, error } = await supabase
          .from("spaces")
          .select("*")
          .eq("id", (pageLookup as { space_id: string }).space_id)
          .eq("is_publishable", true)
          .single();
        if (error || !data) {
          notFound();
          return;
        }
        spaceRow = data as SpaceRow;
      }

      const space = mapSpaceRow(spaceRow);
      if (space.organizationId !== organizationId) {
        notFound();
        return;
      }

      const { data: pageRows, error: pageError } = await supabase
        .from("pages")
        .select("*")
        .eq("space_id", space.id)
        .eq("is_published", true);
      if (pageError) {
        console.error("[beacon] failed to load public space pages:", pageError);
        notFound();
        return;
      }
      const pages = buildPageTree(((pageRows ?? []) as PageRow[]).map(mapPageRow));

      if (!cancelled) setState({ key: requestKey, status: "ready", data: { space, pages } });
    })();

    return () => {
      cancelled = true;
    };
  }, [requestKey, organizationId, spaceSlug, pageSlug]);

  if (!requestKey) return { status: "not-found", data: null };
  if (!state || state.key !== requestKey) return { status: "loading", data: null };
  return state.status === "ready"
    ? { status: "ready", data: state.data }
    : { status: "not-found", data: null };
}

/**
 * A single published Page, looked up by its slug scoped to its Organization
 * (slugs are unique per-Organization, not globally — see
 * pages_organization_id_slug_unique) — returns "not-found" if not published,
 * missing, or owned by a different Organization (never a fallback), and
 * "loading" while the lookup is in flight.
 */
export function usePublicPage(pageSlug: string | undefined, organizationId: string | undefined): PublicLookup<PublicPageResult> {
  const requestKey = pageSlug && organizationId ? `${organizationId}|${pageSlug}` : null;
  const [state, setState] = useState<ResolvedState<PublicPageResult> | null>(null);

  useEffect(() => {
    if (!requestKey || !pageSlug || !organizationId) return;
    let cancelled = false;

    const notFound = () => {
      if (!cancelled) setState({ key: requestKey, status: "not-found", data: null });
    };

    (async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: pageRow, error: pageError } = await supabase
        .from("pages")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("slug", pageSlug)
        .single();
      if (pageError || !pageRow) {
        notFound();
        return;
      }
      const page = mapPageRow(pageRow as PageRow);
      if (!page.isPublished || !page.publishedContentSnapshot) {
        notFound();
        return;
      }

      const { data: spaceRow, error: spaceError } = await supabase
        .from("spaces")
        .select("*")
        .eq("id", page.spaceId)
        .single();
      if (spaceError || !spaceRow) {
        notFound();
        return;
      }
      const space = mapSpaceRow(spaceRow as SpaceRow);
      if (space.organizationId !== organizationId || !space.isPublishable) {
        notFound();
        return;
      }

      if (!cancelled) setState({ key: requestKey, status: "ready", data: { page, space } });
    })();

    return () => {
      cancelled = true;
    };
  }, [requestKey, pageSlug, organizationId]);

  if (!requestKey) return { status: "not-found", data: null };
  if (!state || state.key !== requestKey) return { status: "loading", data: null };
  return state.status === "ready"
    ? { status: "ready", data: state.data }
    : { status: "not-found", data: null };
}
