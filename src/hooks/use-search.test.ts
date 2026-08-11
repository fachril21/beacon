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
      published_content_snapshot: { title: "Menghubungkan akun Google", content: emptyDoc(), screenshotBlocks: {}, publishedAt: "t" },
      spaces: { name: "Mobile App", organization_id: "org-1", is_publishable: true },
    });
    const textSearch = vi.fn(() => Promise.resolve({ data: [row], error: null }));
    const select = vi.fn(() => ({ textSearch }));
    mockSupabase.from.mockReturnValue({ select });

    const { result } = renderHook(() => usePublicSearch("google", "org-1"));
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0]).toMatchObject({ pageId: "page-1", spaceName: "Mobile App" });
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
});
