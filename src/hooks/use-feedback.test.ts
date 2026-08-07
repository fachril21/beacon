import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { feedbackStore } from "@/lib/supabase/stores";

const mockSupabase = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => mockSupabase,
}));

const { usePageFeedback, useHelpfulnessRate, useCreateFeedback } = await import("./use-feedback");

function resetStore() {
  feedbackStore.setState([]);
  feedbackStore.invalidate("page:page-1");
}

describe("usePageFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("loads feedback for a page from Supabase and maps rows to camelCase", async () => {
    mockSupabase.from.mockReturnValue({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [
              { id: "fb-1", page_id: "page-1", helpful: true, comment: null, created_at: "2026-01-01T00:00:00Z" },
              { id: "fb-2", page_id: "page-1", helpful: false, comment: "Kurang jelas", created_at: "2026-01-02T00:00:00Z" },
            ],
            error: null,
          }),
      }),
    });

    const { result } = renderHook(() => usePageFeedback("page-1"));
    await waitFor(() =>
      expect(result.current).toEqual([
        { id: "fb-1", pageId: "page-1", helpful: true, comment: null, createdAt: "2026-01-01T00:00:00Z" },
        { id: "fb-2", pageId: "page-1", helpful: false, comment: "Kurang jelas", createdAt: "2026-01-02T00:00:00Z" },
      ]),
    );
  });

  it("returns an empty array for an undefined pageId without querying Supabase", () => {
    const { result } = renderHook(() => usePageFeedback(undefined));
    expect(result.current).toEqual([]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe("useHelpfulnessRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("computes yes/total/rate from loaded feedback", async () => {
    mockSupabase.from.mockReturnValue({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [
              { id: "fb-1", page_id: "page-1", helpful: true, comment: null, created_at: "2026-01-01T00:00:00Z" },
              { id: "fb-2", page_id: "page-1", helpful: true, comment: null, created_at: "2026-01-01T00:00:00Z" },
              { id: "fb-3", page_id: "page-1", helpful: false, comment: null, created_at: "2026-01-01T00:00:00Z" },
            ],
            error: null,
          }),
      }),
    });

    const { result } = renderHook(() => useHelpfulnessRate("page-1"));
    await waitFor(() => expect(result.current).toEqual({ yes: 2, total: 3, rate: 2 / 3 }));
  });

  it("returns a null rate when there is no feedback yet", () => {
    const { result } = renderHook(() => useHelpfulnessRate(undefined));
    expect(result.current).toEqual({ yes: 0, total: 0, rate: null });
  });
});

describe("useCreateFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("inserts a feedback row via Supabase and returns once it resolves", async () => {
    const insert = vi.fn(() => ({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: { id: "fb-1", page_id: "page-1", helpful: true, comment: null, created_at: "2026-01-01T00:00:00Z" },
            error: null,
          }),
      }),
    }));
    mockSupabase.from.mockReturnValue({ insert });

    const { result } = renderHook(() => useCreateFeedback());
    await act(async () => {
      await result.current("page-1", true, null);
    });

    expect(insert).toHaveBeenCalledWith({ page_id: "page-1", helpful: true, comment: null });
  });

  it("propagates a Supabase error (e.g. rate limit rejection) so the widget can show a retry state", async () => {
    mockSupabase.from.mockReturnValue({
      insert: () => ({
        select: () => ({ single: () => Promise.resolve({ data: null, error: { message: "new row violates row-level security policy" } }) }),
      }),
    });

    const { result } = renderHook(() => useCreateFeedback());
    await expect(result.current("page-1", true, null)).rejects.toBeTruthy();
  });
});
