import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { emptyDoc } from "@/lib/mock/blocknote-content";

const mockSupabase = { from: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => mockSupabase }));

const { usePublicToc, usePublicPage } = await import("./use-public-content");

describe("usePublicToc", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries only publishable Spaces in the given Organization, then their published Pages", async () => {
    const spaceRow = {
      id: "space-1",
      organization_id: "org-1",
      name: "Mobile App",
      category: null,
      is_publishable: true,
      created_by_user_id: "user-1",
      created_at: "t",
    };
    const pageRow = {
      id: "page-1",
      space_id: "space-1",
      parent_page_id: null,
      title: "Getting started",
      order: 0,
      content: emptyDoc(),
      visibility: "publishable",
      is_published: true,
      published_content_snapshot: { title: "Getting started", content: emptyDoc(), screenshotBlocks: {}, publishedAt: "t" },
      published_at: "t",
      created_by_user_id: "user-1",
      created_at: "t",
      updated_at: "t",
    };

    const spacesEq2 = vi.fn(() => Promise.resolve({ data: [spaceRow], error: null }));
    const spacesEq1 = vi.fn(() => ({ eq: spacesEq2 }));
    const pagesEq = vi.fn(() => Promise.resolve({ data: [pageRow], error: null }));
    const pagesIn = vi.fn(() => ({ eq: pagesEq }));

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "spaces") return { select: () => ({ eq: spacesEq1 }) };
      if (table === "pages") return { select: () => ({ in: pagesIn }) };
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => usePublicToc("org-1"));
    await waitFor(() => expect(result.current).toHaveLength(1));

    expect(spacesEq1).toHaveBeenCalledWith("organization_id", "org-1");
    expect(spacesEq2).toHaveBeenCalledWith("is_publishable", true);
    expect(pagesIn).toHaveBeenCalledWith("space_id", ["space-1"]);
    expect(result.current[0]).toMatchObject({
      space: { id: "space-1" },
      pages: [{ page: { id: "page-1" }, children: [] }],
    });
  });

  it("returns an empty array without querying when organizationId is undefined", () => {
    const { result } = renderHook(() => usePublicToc(undefined));
    expect(result.current).toEqual([]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("nests a published child page under its published parent instead of listing it flat", async () => {
    const spaceRow = {
      id: "space-1",
      organization_id: "org-1",
      name: "Mobile App",
      category: null,
      is_publishable: true,
      created_by_user_id: "user-1",
      created_at: "t",
    };
    const parentRow = {
      id: "parent",
      space_id: "space-1",
      parent_page_id: null,
      title: "Parent",
      order: 0,
      content: emptyDoc(),
      visibility: "publishable",
      is_published: true,
      published_content_snapshot: { title: "Parent", content: emptyDoc(), screenshotBlocks: {}, publishedAt: "t" },
      published_at: "t",
      created_by_user_id: "user-1",
      created_at: "t",
      updated_at: "t",
    };
    const childRow = {
      ...parentRow,
      id: "child",
      parent_page_id: "parent",
      title: "Child",
      order: 0,
      published_content_snapshot: { title: "Child", content: emptyDoc(), screenshotBlocks: {}, publishedAt: "t" },
    };

    const spacesEq2 = vi.fn(() => Promise.resolve({ data: [spaceRow], error: null }));
    const spacesEq1 = vi.fn(() => ({ eq: spacesEq2 }));
    const pagesEq = vi.fn(() => Promise.resolve({ data: [childRow, parentRow], error: null }));
    const pagesIn = vi.fn(() => ({ eq: pagesEq }));

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "spaces") return { select: () => ({ eq: spacesEq1 }) };
      if (table === "pages") return { select: () => ({ in: pagesIn }) };
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => usePublicToc("org-1"));
    await waitFor(() => expect(result.current).toHaveLength(1));

    const { pages } = result.current[0];
    expect(pages).toHaveLength(1);
    expect(pages[0].page.id).toBe("parent");
    expect(pages[0].children).toHaveLength(1);
    expect(pages[0].children[0].page.id).toBe("child");
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
