import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { pagesStore } from "@/lib/supabase/stores";
import { emptyDoc } from "@/lib/mock/lexical-content";

const mockSupabase = { from: vi.fn(), rpc: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => mockSupabase }));

const { useCreatePage, useUpdatePageContent, useReorderPages, usePublishActions } = await import("./use-pages");

function resetStore() {
  pagesStore.setState([]);
  pagesStore.invalidate("all");
}

describe("useCreatePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("computes sibling order server-side (count of existing siblings) and inserts", async () => {
    // .select().eq(space_id).is(parent_page_id, null) resolves to a count response.
    const afterSpaceEq = {
      is: vi.fn(() => Promise.resolve({ count: 2, error: null })),
      eq: vi.fn(() => Promise.resolve({ count: 2, error: null })),
    };
    const selectForCount = vi.fn(() => ({ eq: vi.fn(() => afterSpaceEq) }));

    const insertedRow = {
      id: "page-1",
      space_id: "space-1",
      parent_page_id: null,
      title: "Untitled",
      order: 2,
      content: emptyDoc(),
      visibility: "internal",
      is_published: false,
      published_content_snapshot: null,
      published_at: null,
      created_by_user_id: "user-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const insert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: insertedRow, error: null }) }) }));

    mockSupabase.from.mockReturnValue({
      select: selectForCount,
      insert,
    });

    const { result } = renderHook(() => useCreatePage());
    let created: unknown;
    await act(async () => {
      created = await result.current({
        spaceId: "space-1",
        parentPageId: null,
        title: "Untitled",
        createdByUserId: "user-1",
      });
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ space_id: "space-1", order: 2, title: "Untitled" }));
    expect(created).toMatchObject({ id: "page-1", order: 2 });
    expect(pagesStore.getState()).toEqual([expect.objectContaining({ id: "page-1" })]);
  });
});

describe("useUpdatePageContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    pagesStore.setState([
      {
        id: "page-1",
        spaceId: "space-1",
        parentPageId: null,
        title: "Untitled",
        order: 0,
        content: emptyDoc(),
        visibility: "internal",
        isPublished: false,
        publishedContentSnapshot: null,
        publishedAt: null,
        createdByUserId: "user-1",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("updates the row in Supabase and patches the local store", async () => {
    const update = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    mockSupabase.from.mockReturnValue({ update });

    const newContent = emptyDoc();
    const { result } = renderHook(() => useUpdatePageContent());
    await act(async () => {
      await result.current("page-1", newContent);
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ content: newContent }));
    expect(pagesStore.getState()[0].content).toEqual(newContent);
  });
});

describe("useReorderPages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    pagesStore.setState([
      { id: "a", spaceId: "space-1", parentPageId: null, title: "A", order: 0, content: emptyDoc(), visibility: "internal", isPublished: false, publishedContentSnapshot: null, publishedAt: null, createdByUserId: "user-1", createdAt: "t", updatedAt: "t" },
      { id: "b", spaceId: "space-1", parentPageId: null, title: "B", order: 1, content: emptyDoc(), visibility: "internal", isPublished: false, publishedContentSnapshot: null, publishedAt: null, createdByUserId: "user-1", createdAt: "t", updatedAt: "t" },
    ]);
  });

  it("issues one update per reordered sibling and patches the local store", async () => {
    const eqMock = vi.fn(() => Promise.resolve({ error: null }));
    const update = vi.fn(() => ({ eq: eqMock }));
    mockSupabase.from.mockReturnValue({ update });

    const { result } = renderHook(() => useReorderPages());
    await act(async () => {
      await result.current("space-1", null, ["b", "a"]);
    });

    expect(update).toHaveBeenCalledWith({ order: 0 });
    expect(update).toHaveBeenCalledWith({ order: 1 });
    const byId = Object.fromEntries(pagesStore.getState().map((p) => [p.id, p.order]));
    expect(byId).toEqual({ a: 1, b: 0 });
  });
});

describe("usePublishActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    pagesStore.setState([
      {
        id: "page-1",
        spaceId: "space-1",
        parentPageId: null,
        title: "Getting started",
        order: 0,
        content: emptyDoc(),
        visibility: "publishable",
        isPublished: false,
        publishedContentSnapshot: null,
        publishedAt: null,
        createdByUserId: "user-1",
        createdAt: "t",
        updatedAt: "t",
      },
    ]);
  });

  it("publish calls the publish_page RPC and patches the store from its (atomic) result", async () => {
    const publishedRow = {
      id: "page-1",
      space_id: "space-1",
      parent_page_id: null,
      title: "Getting started",
      order: 0,
      content: emptyDoc(),
      visibility: "publishable",
      is_published: true,
      published_content_snapshot: { title: "Getting started", content: emptyDoc(), screenshotBlocks: {}, publishedAt: "2026-01-01T00:00:00Z" },
      published_at: "2026-01-01T00:00:00Z",
      created_by_user_id: "user-1",
      created_at: "t",
      updated_at: "t",
    };
    mockSupabase.rpc.mockResolvedValue({ data: publishedRow, error: null });

    const { result } = renderHook(() => usePublishActions());
    await act(async () => {
      await result.current.publish("page-1");
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith("publish_page", { p_page_id: "page-1" });
    expect(pagesStore.getState()[0].isPublished).toBe(true);
    expect(pagesStore.getState()[0].publishedContentSnapshot).not.toBeNull();
  });

  it("unpublish calls the unpublish_page RPC and patches the store", async () => {
    pagesStore.setState((prev) => prev.map((p) => ({ ...p, isPublished: true })));
    const unpublishedRow = {
      id: "page-1",
      space_id: "space-1",
      parent_page_id: null,
      title: "Getting started",
      order: 0,
      content: emptyDoc(),
      visibility: "publishable",
      is_published: false,
      published_content_snapshot: { title: "Getting started", content: emptyDoc(), screenshotBlocks: {}, publishedAt: "t" },
      published_at: "t",
      created_by_user_id: "user-1",
      created_at: "t",
      updated_at: "t",
    };
    mockSupabase.rpc.mockResolvedValue({ data: unpublishedRow, error: null });

    const { result } = renderHook(() => usePublishActions());
    await act(async () => {
      await result.current.unpublish("page-1");
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith("unpublish_page", { p_page_id: "page-1" });
    expect(pagesStore.getState()[0].isPublished).toBe(false);
  });

  it("throws when the RPC returns an error, without touching the local store", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "permission denied" } });

    const { result } = renderHook(() => usePublishActions());
    await expect(result.current.publish("page-1")).rejects.toThrow();
    expect(pagesStore.getState()[0].isPublished).toBe(false);
  });
});
