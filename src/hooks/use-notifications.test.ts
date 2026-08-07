import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { notificationsStore } from "@/lib/supabase/stores";

const mockSupabase = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => mockSupabase,
}));

const { useNotifications, useUnreadNotificationCount, useMarkNotificationRead } = await import("./use-notifications");

function resetStore() {
  notificationsStore.setState([]);
  notificationsStore.invalidate("user:user-1");
}

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("loads the current user's notifications from Supabase, newest first", async () => {
    mockSupabase.from.mockReturnValue({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [
              { id: "n-1", recipient_user_id: "user-1", actor_user_id: "user-2", page_id: "page-1", comment_id: "c-1", is_read: false, created_at: "2026-01-01T00:00:00Z" },
              { id: "n-2", recipient_user_id: "user-1", actor_user_id: "user-2", page_id: "page-1", comment_id: "c-2", is_read: false, created_at: "2026-01-02T00:00:00Z" },
            ],
            error: null,
          }),
      }),
    });

    const { result } = renderHook(() => useNotifications("user-1"));
    await waitFor(() => expect(result.current.map((n) => n.id)).toEqual(["n-2", "n-1"]));
  });

  it("returns an empty array for an undefined userId without querying Supabase", () => {
    const { result } = renderHook(() => useNotifications(undefined));
    expect(result.current).toEqual([]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe("useUnreadNotificationCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("counts only unread notifications for the given user", async () => {
    mockSupabase.from.mockReturnValue({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [
              { id: "n-1", recipient_user_id: "user-1", actor_user_id: "user-2", page_id: "page-1", comment_id: "c-1", is_read: false, created_at: "2026-01-01T00:00:00Z" },
              { id: "n-2", recipient_user_id: "user-1", actor_user_id: "user-2", page_id: "page-1", comment_id: "c-2", is_read: true, created_at: "2026-01-02T00:00:00Z" },
            ],
            error: null,
          }),
      }),
    });

    const { result } = renderHook(() => useUnreadNotificationCount("user-1"));
    await waitFor(() => expect(result.current).toBe(1));
  });
});

describe("useMarkNotificationRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    notificationsStore.setState([
      { id: "n-1", recipientUserId: "user-1", actorUserId: "user-2", pageId: "page-1", commentId: "c-1", isRead: false, createdAt: "2026-01-01T00:00:00Z" },
    ]);
  });

  it("updates is_read via Supabase and patches the store", async () => {
    const update = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    mockSupabase.from.mockReturnValue({ update });

    const { result } = renderHook(() => useMarkNotificationRead());
    await act(async () => {
      await result.current("n-1");
    });

    expect(update).toHaveBeenCalledWith({ is_read: true });
    expect(notificationsStore.getState()[0].isRead).toBe(true);
  });
});
