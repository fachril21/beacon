import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { commentsStore } from "@/lib/supabase/stores";

const mockSupabase = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => mockSupabase,
}));

const { usePageComments, useBlockComments, useCreateComment } = await import("./use-comments");

function resetStore() {
  commentsStore.setState([]);
  commentsStore.invalidate("page:page-1");
}

describe("usePageComments / useBlockComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("loads comments for a page from Supabase and maps rows to camelCase", async () => {
    mockSupabase.from.mockReturnValue({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [
              {
                id: "c-1",
                page_id: "page-1",
                block_id: "block-1",
                author_user_id: "user-1",
                body: "Halo",
                mentioned_user_ids: ["user-2"],
                created_at: "2026-01-01T00:00:00Z",
              },
            ],
            error: null,
          }),
      }),
    });

    const { result } = renderHook(() => usePageComments("page-1"));
    await waitFor(() =>
      expect(result.current).toEqual([
        {
          id: "c-1",
          pageId: "page-1",
          blockId: "block-1",
          authorUserId: "user-1",
          body: "Halo",
          mentionedUserIds: ["user-2"],
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]),
    );
  });

  it("useBlockComments filters by blockId and sorts ascending by createdAt", async () => {
    mockSupabase.from.mockReturnValue({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [
              { id: "c-2", page_id: "page-1", block_id: "block-1", author_user_id: "user-1", body: "Kedua", mentioned_user_ids: [], created_at: "2026-01-02T00:00:00Z" },
              { id: "c-1", page_id: "page-1", block_id: "block-1", author_user_id: "user-1", body: "Pertama", mentioned_user_ids: [], created_at: "2026-01-01T00:00:00Z" },
              { id: "c-3", page_id: "page-1", block_id: "block-2", author_user_id: "user-1", body: "Blok lain", mentioned_user_ids: [], created_at: "2026-01-01T12:00:00Z" },
            ],
            error: null,
          }),
      }),
    });

    const { result } = renderHook(() => useBlockComments("page-1", "block-1"));
    await waitFor(() => expect(result.current.map((c) => c.id)).toEqual(["c-1", "c-2"]));
  });
});

describe("useCreateComment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("inserts the comment via Supabase and patches the store", async () => {
    const commentInsert = vi.fn(() => ({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: {
              id: "c-1",
              page_id: "page-1",
              block_id: "block-1",
              author_user_id: "user-1",
              body: "Halo",
              mentioned_user_ids: [],
              created_at: "2026-01-01T00:00:00Z",
            },
            error: null,
          }),
      }),
    }));
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "comments") return { insert: commentInsert };
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => useCreateComment());
    await act(async () => {
      await result.current("page-1", "block-1", "user-1", "Halo", []);
    });

    expect(commentInsert).toHaveBeenCalledWith({
      page_id: "page-1",
      block_id: "block-1",
      author_user_id: "user-1",
      body: "Halo",
      mentioned_user_ids: [],
    });
    expect(commentsStore.getState()).toEqual([
      { id: "c-1", pageId: "page-1", blockId: "block-1", authorUserId: "user-1", body: "Halo", mentionedUserIds: [], createdAt: "2026-01-01T00:00:00Z" },
    ]);
  });

  it("inserts one notification row per mentioned user, excluding the author's own mention of themselves", async () => {
    const commentInsert = vi.fn(() => ({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: {
              id: "c-1",
              page_id: "page-1",
              block_id: "block-1",
              author_user_id: "user-1",
              body: "Halo @user-2 @user-1",
              mentioned_user_ids: ["user-2", "user-1"],
              created_at: "2026-01-01T00:00:00Z",
            },
            error: null,
          }),
      }),
    }));
    const notificationInsert = vi.fn(() => Promise.resolve({ error: null }));
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "comments") return { insert: commentInsert };
      if (table === "notifications") return { insert: notificationInsert };
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => useCreateComment());
    await act(async () => {
      await result.current("page-1", "block-1", "user-1", "Halo @user-2 @user-1", ["user-2", "user-1"]);
    });

    expect(notificationInsert).toHaveBeenCalledTimes(1);
    expect(notificationInsert).toHaveBeenCalledWith([
      { recipient_user_id: "user-2", actor_user_id: "user-1", page_id: "page-1", comment_id: "c-1" },
    ]);
  });
});
