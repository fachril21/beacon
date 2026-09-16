import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { emptyDoc } from "@/lib/mock/blocknote-content";

const mockSupabase = { from: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => mockSupabase }));

const { useInternalSearch, usePublicSearch } = await import("./use-search");

function pageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "page-1",
    space_id: "space-1",
    parent_page_id: null,
    title: "Menghubungkan akun Google",
    order: 0,
    content: emptyDoc(),
    visibility: "internal",
    is_published: false,
    published_content_snapshot: null,
    published_at: null,
    created_by_user_id: "user-1",
    created_at: "t",
    updated_at: "t",
    search_text: "Buka pengaturan lalu pilih akun Google",
    ...overrides,
  };
}

describe("useInternalSearch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] without querying for an empty query", () => {
    const { result } = renderHook(() => useInternalSearch("", "user-1"));
    expect(result.current).toEqual([]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("full-text searches pages.search_vector (RLS-scoped by the authenticated role) and joins the Space name for the breadcrumb", async () => {
    const textSearch = vi.fn(() => Promise.resolve({ data: [{ ...pageRow(), spaces: { name: "Mobile App" } }], error: null }));
    const select = vi.fn(() => ({ textSearch }));
    mockSupabase.from.mockReturnValue({ select });

    const { result } = renderHook(() => useInternalSearch("google", "user-1"));
    await waitFor(() => expect(result.current).toHaveLength(1));

    expect(textSearch).toHaveBeenCalledWith("search_vector", "google", { type: "websearch", config: "simple" });
    expect(result.current[0]).toMatchObject({
      pageId: "page-1",
      spaceId: "space-1",
      spaceName: "Mobile App",
      pageTitle: "Menghubungkan akun Google",
    });
    expect(result.current[0].snippet).toContain("Google");
  });

  it("scopes results to the given Organization when one is passed, excluding Pages from other Organizations the caller also belongs to", async () => {
    const rows = [
      { ...pageRow({ id: "page-1" }), spaces: { name: "Mobile App", organization_id: "org-1" } },
      { ...pageRow({ id: "page-2", space_id: "space-2" }), spaces: { name: "Other Org Space", organization_id: "org-2" } },
    ];
    const textSearch = vi.fn(() => Promise.resolve({ data: rows, error: null }));
    mockSupabase.from.mockReturnValue({ select: () => ({ textSearch }) });

    const { result } = renderHook(() => useInternalSearch("google", "user-1", "org-1"));
    await waitFor(() => expect(result.current).toHaveLength(1));

    expect(result.current[0].pageId).toBe("page-1");
  });

  it("returns every accessible result when no Organization is passed (backward compatible)", async () => {
    const rows = [
      { ...pageRow({ id: "page-1" }), spaces: { name: "Mobile App", organization_id: "org-1" } },
      { ...pageRow({ id: "page-2", space_id: "space-2" }), spaces: { name: "Other Org Space", organization_id: "org-2" } },
    ];
    const textSearch = vi.fn(() => Promise.resolve({ data: rows, error: null }));
    mockSupabase.from.mockReturnValue({ select: () => ({ textSearch }) });

    const { result } = renderHook(() => useInternalSearch("google", "user-1"));
    await waitFor(() => expect(result.current).toHaveLength(2));
  });
});

describe("usePublicSearch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns [] without querying for an empty query", () => {
    const { result } = renderHook(() => usePublicSearch("", "org-1"));
    expect(result.current).toEqual([]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("scopes results to the given Organization's publishable Spaces, using the published snapshot's title", async () => {
    const row = pageRow({
      is_published: true,
      visibility: "publishable",
      slug: "menghubungkan-akun-google",
      published_content_snapshot: { title: "Menghubungkan akun Google", content: emptyDoc(), screenshotBlocks: {}, publishedAt: "t" },
      spaces: { name: "Mobile App", organization_id: "org-1", is_publishable: true },
    });
    const textSearch = vi.fn(() => Promise.resolve({ data: [row], error: null }));
    const select = vi.fn(() => ({ textSearch }));
    mockSupabase.from.mockReturnValue({ select });

    const { result } = renderHook(() => usePublicSearch("google", "org-1"));
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]).toMatchObject({ pageId: "page-1", pageSlug: "menghubungkan-akun-google", spaceName: "Mobile App" });
  });

  it("never returns a result from a different Organization than the one requested", async () => {
    const row = pageRow({
      is_published: true,
      visibility: "publishable",
      published_content_snapshot: { title: "Menghubungkan akun Google", content: emptyDoc(), screenshotBlocks: {}, publishedAt: "t" },
      spaces: { name: "Mobile App", organization_id: "org-OTHER", is_publishable: true },
    });
    const textSearch = vi.fn(() => Promise.resolve({ data: [row], error: null }));
    const select = vi.fn(() => ({ textSearch }));
    mockSupabase.from.mockReturnValue({ select });

    const { result } = renderHook(() => usePublicSearch("google", "org-1"));
    await waitFor(() => expect(textSearch).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });

  it("scopes results to a single Space when a spaceId is given (no cross-Space results)", async () => {
    const inSpace = pageRow({
      id: "page-1",
      space_id: "space-1",
      is_published: true,
      visibility: "publishable",
      slug: "in-space",
      published_content_snapshot: { title: "In space", content: emptyDoc(), screenshotBlocks: {}, publishedAt: "t" },
      spaces: { name: "Mobile App", organization_id: "org-1", is_publishable: true },
    });
    const otherSpace = pageRow({
      id: "page-2",
      space_id: "space-2",
      is_published: true,
      visibility: "publishable",
      slug: "other-space",
      published_content_snapshot: { title: "Other space", content: emptyDoc(), screenshotBlocks: {}, publishedAt: "t" },
      spaces: { name: "Onboarding", organization_id: "org-1", is_publishable: true },
    });
    const textSearch = vi.fn(() => Promise.resolve({ data: [inSpace, otherSpace], error: null }));
    mockSupabase.from.mockReturnValue({ select: vi.fn(() => ({ textSearch })) });

    const { result } = renderHook(() => usePublicSearch("space", "org-1", "space-1"));
    await waitFor(() => expect(textSearch).toHaveBeenCalled());
    expect(result.current.map((r) => r.pageId)).toEqual(["page-1"]);
  });
});
