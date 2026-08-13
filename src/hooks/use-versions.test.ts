import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { versionsStore, pagesStore } from "@/lib/supabase/stores";
import { emptyDoc } from "@/lib/mock/blocknote-content";

const mockSupabase = { from: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => mockSupabase }));

const { useCreateVersion, useRestoreVersion } = await import("./use-versions");

function resetStores() {
  versionsStore.setState([]);
  versionsStore.invalidate("all");
  pagesStore.setState([]);
  pagesStore.invalidate("all");
}

describe("useCreateVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("inserts a versions row and patches the local store", async () => {
    const row = {
      id: "version-1",
      page_id: "page-1",
      title: "Getting started",
      content: emptyDoc(),
      created_by_user_id: "user-1",
      created_at: "2026-01-01T00:00:00Z",
      is_restore_of: null,
    };
    mockSupabase.from.mockReturnValue({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: row, error: null }) }) }),
    });

    const { result } = renderHook(() => useCreateVersion());
    await act(async () => {
      await result.current("page-1", "Getting started", emptyDoc(), "user-1");
    });

    expect(versionsStore.getState()).toEqual([expect.objectContaining({ id: "version-1", isRestoreOf: null })]);
  });
});

describe("useRestoreVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
    versionsStore.setState([
      {
        id: "version-1",
        pageId: "page-1",
        title: "Old title",
        content: emptyDoc(),
        createdByUserId: "user-1",
        createdAt: "2026-01-01T00:00:00Z",
        isRestoreOf: null,
      },
    ]);
    pagesStore.setState([
      {
        id: "page-1",
        spaceId: "space-1",
        parentPageId: null,
        title: "Current title",
        order: 0,
        content: emptyDoc(),
        visibility: "internal",
        slug: null,
        isPublished: false,
        publishedContentSnapshot: null,
        publishedAt: null,
        createdByUserId: "user-1",
        createdAt: "t",
        updatedAt: "t",
      },
    ]);
  });

  it("replaces the live Page draft AND logs a new version marking the restore (never destructive)", async () => {
    const pagesUpdate = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    const restoreVersionRow = {
      id: "version-2",
      page_id: "page-1",
      title: "Old title",
      content: emptyDoc(),
      created_by_user_id: "user-2",
      created_at: "2026-01-02T00:00:00Z",
      is_restore_of: "version-1",
    };
    const versionsInsert = vi.fn(() => ({
      select: () => ({ single: () => Promise.resolve({ data: restoreVersionRow, error: null }) }),
    }));

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "pages") return { update: pagesUpdate };
      if (table === "versions") return { insert: versionsInsert };
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => useRestoreVersion());
    await act(async () => {
      await result.current("page-1", "version-1", "user-2");
    });

    expect(pagesUpdate).toHaveBeenCalledWith(expect.objectContaining({ title: "Old title" }));
    expect(pagesStore.getState()[0].title).toBe("Old title");

    expect(versionsInsert).toHaveBeenCalledWith(expect.objectContaining({ is_restore_of: "version-1" }));
    expect(versionsStore.getState()).toHaveLength(2);
    expect(versionsStore.getState().some((v) => v.isRestoreOf === "version-1")).toBe(true);
  });
});
