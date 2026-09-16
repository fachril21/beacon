import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { emptyDoc } from "@/lib/mock/blocknote-content";

const mockSupabase = { from: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => mockSupabase }));

let mockParams: Record<string, string | undefined> = {};
vi.mock("next/navigation", () => ({ useParams: () => mockParams }));

const { usePublicSpaces, usePublicCurrentSpace, usePublicPage } = await import("./use-public-content");

/** Chainable + awaitable Supabase query-builder stub resolving to `response`. */
function qb(response: { data: unknown; error: unknown }) {
  const stub: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order"]) stub[m] = vi.fn(() => stub);
  stub.single = vi.fn(() => Promise.resolve(response));
  stub.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject);
  return stub;
}

/** Queue one response per `from(table)` call, in order; last entry repeats. */
function mockFrom(handlers: Record<string, { data: unknown; error: unknown }[]>) {
  const counts: Record<string, number> = {};
  mockSupabase.from.mockImplementation((table: string) => {
    const list = handlers[table];
    if (!list) throw new Error(`unexpected table ${table}`);
    const i = counts[table] ?? 0;
    counts[table] = i + 1;
    return qb(list[Math.min(i, list.length - 1)]);
  });
}

const spaceRow = (over: Record<string, unknown> = {}) => ({
  id: "space-1",
  organization_id: "org-1",
  name: "Mobile App",
  slug: "mobile-app",
  category: null,
  is_publishable: true,
  created_by_user_id: "user-1",
  created_at: "t",
  ...over,
});

const publishedPageRow = (over: Record<string, unknown> = {}) => ({
  id: "page-1",
  space_id: "space-1",
  parent_page_id: null,
  title: "Getting started",
  order: 0,
  content: emptyDoc(),
  visibility: "publishable",
  slug: "getting-started",
  is_published: true,
  published_content_snapshot: { title: "Getting started", content: emptyDoc(), screenshotBlocks: {}, publishedAt: "t" },
  published_at: "t",
  created_by_user_id: "user-1",
  created_at: "t",
  updated_at: "t",
  ...over,
});

describe("usePublicSpaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = {};
  });

  it("returns publishable Spaces of the Organization that have at least one published Page, with a page count", async () => {
    mockFrom({
      spaces: [{ data: [spaceRow(), spaceRow({ id: "space-2", slug: "empty-space" })], error: null }],
      pages: [{ data: [{ space_id: "space-1" }, { space_id: "space-1" }], error: null }],
    });

    const { result } = renderHook(() => usePublicSpaces("org-1"));
    await waitFor(() => expect(result.current).toHaveLength(1));

    expect(result.current[0]).toMatchObject({ space: { id: "space-1", slug: "mobile-app" }, publishedPageCount: 2 });
  });

  it("returns an empty array without querying when organizationId is undefined", () => {
    const { result } = renderHook(() => usePublicSpaces(undefined));
    expect(result.current).toEqual([]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe("usePublicCurrentSpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = {};
  });

  it("returns null without querying on the directory route (no spaceSlug, no pageSlug)", () => {
    const { result } = renderHook(() => usePublicCurrentSpace("org-1"));
    expect(result.current).toBeNull();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("resolves the Space by its slug and returns only that Space's published page tree", async () => {
    mockParams = { orgSlug: "dibimbing", spaceSlug: "mobile-app" };
    mockFrom({
      spaces: [{ data: spaceRow(), error: null }],
      pages: [{ data: [publishedPageRow(), publishedPageRow({ id: "page-2", parent_page_id: "page-1" })], error: null }],
    });

    const { result } = renderHook(() => usePublicCurrentSpace("org-1"));
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current!.space).toMatchObject({ id: "space-1", slug: "mobile-app" });
    expect(result.current!.pages).toHaveLength(1);
    expect(result.current!.pages[0].page.id).toBe("page-1");
    expect(result.current!.pages[0].children[0].page.id).toBe("page-2");
  });

  it("on a page route resolves the current Space from the published Page's own space_id", async () => {
    mockParams = { orgSlug: "dibimbing", pageSlug: "getting-started" };
    mockFrom({
      pages: [
        { data: { space_id: "space-1" }, error: null }, // slug lookup
        { data: [publishedPageRow()], error: null }, // the space's page list
      ],
      spaces: [{ data: spaceRow(), error: null }],
    });

    const { result } = renderHook(() => usePublicCurrentSpace("org-1"));
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current!.space).toMatchObject({ id: "space-1" });
    expect(result.current!.pages[0].page.id).toBe("page-1");
  });

  it("returns null when the slug matches no publishable Space (never a fallback)", async () => {
    mockParams = { orgSlug: "dibimbing", spaceSlug: "does-not-exist" };
    mockFrom({ spaces: [{ data: null, error: { message: "no rows" } }] });

    const { result } = renderHook(() => usePublicCurrentSpace("org-1"));
    await waitFor(() => expect(mockSupabase.from).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});

describe("usePublicPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("looks the Page up by (organization_id, slug) — never a bare slug across Organizations", async () => {
    const pageRow = {
      id: "page-1",
      space_id: "space-1",
      parent_page_id: null,
      title: "Getting started",
      order: 0,
      content: emptyDoc(),
      visibility: "publishable",
      slug: "getting-started",
      is_published: true,
      published_content_snapshot: { title: "Getting started", content: emptyDoc(), screenshotBlocks: {}, publishedAt: "t" },
      published_at: "t",
      created_by_user_id: "user-1",
      created_at: "t",
      updated_at: "t",
    };
    const spaceRow = {
      id: "space-1",
      organization_id: "org-1",
      name: "Mobile App",
      category: null,
      is_publishable: true,
      created_by_user_id: "user-1",
      created_at: "t",
    };

    const pagesEqSlug = vi.fn(() => ({ single: () => Promise.resolve({ data: pageRow, error: null }) }));
    const pagesEqOrg = vi.fn(() => ({ eq: pagesEqSlug }));
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "pages") return { select: () => ({ eq: pagesEqOrg }) };
      if (table === "spaces") return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: spaceRow, error: null }) }) }) };
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => usePublicPage("getting-started", "org-1"));
    await waitFor(() => expect(result.current).not.toBeNull());

    expect(pagesEqOrg).toHaveBeenCalledWith("organization_id", "org-1");
    expect(pagesEqSlug).toHaveBeenCalledWith("slug", "getting-started");
    expect(result.current).toMatchObject({ page: { id: "page-1", slug: "getting-started" }, space: { id: "space-1" } });
  });

  it("returns null (never a fallback) when the Page's Space belongs to a different Organization than expected", async () => {
    const pageRow = {
      id: "page-1",
      space_id: "space-1",
      parent_page_id: null,
      title: "Getting started",
      order: 0,
      content: emptyDoc(),
      visibility: "publishable",
      slug: "getting-started",
      is_published: true,
      published_content_snapshot: { title: "Getting started", content: emptyDoc(), screenshotBlocks: {}, publishedAt: "t" },
      published_at: "t",
      created_by_user_id: "user-1",
      created_at: "t",
      updated_at: "t",
    };
    const spaceRow = {
      id: "space-1",
      organization_id: "org-OTHER",
      name: "Mobile App",
      category: null,
      is_publishable: true,
      created_by_user_id: "user-1",
      created_at: "t",
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "pages") return { select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: pageRow, error: null }) }) }) }) };
      if (table === "spaces") return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: spaceRow, error: null }) }) }) };
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => usePublicPage("getting-started", "org-1"));
    await waitFor(() => expect(result.current).toBeNull());
  });
});
