import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import "fake-indexeddb/auto";
import { versionsStore, pagesStore } from "@/lib/supabase/stores";
import { emptyDoc } from "@/lib/mock/blocknote-content";
import { savePendingEdit, loadPendingEdit } from "@/lib/offline-buffer";
import { getEditorRevision } from "@/lib/editor-revision-store";
import { VERSION_SNAPSHOT_INTERVAL_MS } from "@/lib/version-snapshot";
import type { PageContent } from "@/lib/types";

const mockSupabase = { from: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => mockSupabase }));
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: { id: "user-1" } }) }));

const { useCreateVersion, useRestoreVersion, useVersionSnapshots, usePageVersions } = await import("./use-versions");

const contentA = [{ id: "a", type: "paragraph", content: "A" }] as unknown as PageContent;
const contentB = [{ id: "a", type: "paragraph", content: "B" }] as unknown as PageContent;

function versionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "version-1",
    page_id: "page-1",
    title: "Old title",
    content: contentA,
    created_by_user_id: "user-1",
    created_at: "2026-01-01T00:00:00Z",
    is_restore_of: null,
    ...overrides,
  };
}

/** Chain for `.from("versions").select("*").eq(...).order(...).limit(n)` resolving to `rows`. */
function versionsQuery(rows: unknown[]) {
  const limit = vi.fn(() => Promise.resolve({ data: rows, error: null }));
  const order = vi.fn(() => ({ limit }));
  const eq = vi.fn(() => ({ order }));
  return { select: vi.fn(() => ({ eq })), eq, order, limit };
}

function resetStores() {
  versionsStore.setState([]);
  versionsStore.invalidate("all");
  pagesStore.setState([]);
  pagesStore.invalidate("all");
}

describe("usePageVersions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("loads the newest 50 versions first", async () => {
    const query = versionsQuery([versionRow()]);
    mockSupabase.from.mockReturnValue(query);

    renderHook(() => usePageVersions("page-load"));
    await vi.waitFor(() => expect(versionsStore.getState()).toHaveLength(1));

    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(50);
  });
});

describe("useCreateVersion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("inserts a versions row and patches the local store", async () => {
    const row = versionRow({ id: "version-1", title: "Getting started", content: emptyDoc() });
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

describe("useVersionSnapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  function mockTables(latestRows: unknown[], insert = vi.fn()) {
    const query = versionsQuery(latestRows);
    insert.mockImplementation((payload: Record<string, unknown>) => ({
      select: () => ({ single: () => Promise.resolve({ data: versionRow({ id: "new", ...payload, created_at: new Date().toISOString() }), error: null }) }),
    }));
    mockSupabase.from.mockImplementation(() => ({ ...query, insert }));
    return { query, insert };
  }

  it("creates a baseline version when the page has none", async () => {
    const { insert } = mockTables([]);
    const { result } = renderHook(() => useVersionSnapshots("page-1"));

    await act(async () => {
      await result.current("Judul", contentA);
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ page_id: "page-1", title: "Judul", created_by_user_id: "user-1" }));
  });

  it("skips while the latest version is younger than the snapshot interval", async () => {
    const { insert } = mockTables([versionRow({ created_at: new Date().toISOString() })]);
    const { result } = renderHook(() => useVersionSnapshots("page-1"));

    await act(async () => {
      await result.current("Judul", contentB);
    });

    expect(insert).not.toHaveBeenCalled();
  });

  it("snapshots once the latest version is old enough and content changed, then throttles again", async () => {
    const old = new Date(Date.now() - VERSION_SNAPSHOT_INTERVAL_MS - 1000).toISOString();
    const { insert } = mockTables([versionRow({ created_at: old })]);
    const { result } = renderHook(() => useVersionSnapshots("page-1"));

    await act(async () => {
      await result.current("Judul", contentB);
      await result.current("Judul", contentA); // immediately after: throttled
    });

    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("records the page as it was BEFORE the first edit as the first version, then the edit", async () => {
    const { insert } = mockTables([]);
    const { result } = renderHook(() => useVersionSnapshots("page-1", { title: "Judul awal", content: contentA }));

    await act(async () => {
      await result.current("Judul awal", contentB);
    });

    expect(insert).toHaveBeenNthCalledWith(1, expect.objectContaining({ title: "Judul awal", content: contentA }));
  });

  it("does not record a pre-edit baseline when the first save is identical to it", async () => {
    const { insert } = mockTables([]);
    const { result } = renderHook(() => useVersionSnapshots("page-1", { title: "Judul", content: contentA }));

    await act(async () => {
      await result.current("Judul", contentA);
    });

    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("records the latest throttled edit once the interval has passed (trailing snapshot)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { insert } = mockTables([versionRow({ created_at: new Date().toISOString() })]);
    const { result } = renderHook(() => useVersionSnapshots("page-1"));

    await act(async () => {
      await result.current("Judul", contentB); // throttled: newest version is brand new
    });
    expect(insert).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(VERSION_SNAPSHOT_INTERVAL_MS + 100);
    });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ content: contentB }));
    vi.useRealTimers();
  });

  it("flushes a throttled edit when the editor unmounts so the last change is not lost", async () => {
    const { insert } = mockTables([versionRow({ created_at: new Date().toISOString() })]);
    const { result, unmount } = renderHook(() => useVersionSnapshots("page-1"));

    await act(async () => {
      await result.current("Judul", contentB);
    });
    expect(insert).not.toHaveBeenCalled();

    await act(async () => {
      unmount();
    });
    await vi.waitFor(() => expect(insert).toHaveBeenCalledWith(expect.objectContaining({ content: contentB })));
  });

  it("never throws into the autosave path when the insert fails", async () => {
    const insert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: new Error("rls") }) }) }));
    mockSupabase.from.mockImplementation(() => ({ ...versionsQuery([]), insert }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useVersionSnapshots("page-1"));

    await act(async () => {
      await expect(result.current("Judul", contentA)).resolves.toBeUndefined();
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("useRestoreVersion", () => {
  const pagesUpdate = vi.fn();
  const versionsInsert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
    versionsStore.setState([
      {
        id: "version-1",
        pageId: "page-1",
        title: "Old title",
        content: contentA,
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
        content: contentB,
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

    pagesUpdate.mockImplementation(() => ({ eq: () => Promise.resolve({ error: null }) }));
    let n = 0;
    versionsInsert.mockImplementation((payload: Record<string, unknown>) => ({
      select: () => ({ single: () => Promise.resolve({ data: versionRow({ ...payload, id: `version-new-${++n}`, created_at: `2026-01-02T00:00:0${n}Z` }), error: null }) }),
    }));
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "pages") return { update: pagesUpdate };
      if (table === "versions") return { insert: versionsInsert };
      throw new Error(`unexpected table ${table}`);
    });
  });

  it("replaces the live draft AND logs a new version marking the restore (never destructive)", async () => {
    const { result } = renderHook(() => useRestoreVersion());
    await act(async () => {
      await result.current("page-1", "version-1", "user-2");
    });

    expect(pagesUpdate).toHaveBeenCalledWith(expect.objectContaining({ title: "Old title", content: contentA }));
    expect(pagesStore.getState()[0]).toMatchObject({ title: "Old title", content: contentA });
    expect(versionsInsert).toHaveBeenCalledWith(expect.objectContaining({ is_restore_of: "version-1", created_by_user_id: "user-2" }));
    expect(versionsStore.getState().some((v) => v.isRestoreOf === "version-1")).toBe(true);
  });

  it("first saves the current draft as a version so the pre-restore state is recoverable", async () => {
    const { result } = renderHook(() => useRestoreVersion());
    await act(async () => {
      await result.current("page-1", "version-1", "user-2");
    });

    expect(versionsInsert).toHaveBeenCalledTimes(2);
    expect(versionsInsert).toHaveBeenNthCalledWith(1, expect.objectContaining({ title: "Current title", content: contentB, is_restore_of: null }));
  });

  it("does not duplicate the draft as a version when it already equals the newest version", async () => {
    pagesStore.setState((prev) => prev.map((p) => ({ ...p, title: "Old title", content: contentA })));
    versionsStore.setState((prev) => [...prev, { ...prev[0], id: "version-0", title: "Other", content: contentB, createdAt: "2025-12-31T00:00:00Z" }]);

    const { result } = renderHook(() => useRestoreVersion());
    await act(async () => {
      await result.current("page-1", "version-1", "user-2");
    });

    expect(versionsInsert).toHaveBeenCalledTimes(1);
  });

  it("discards a buffered offline edit and bumps the editor revision so the editor reloads", async () => {
    await savePendingEdit("page-1", contentB);
    const before = getEditorRevision("page-1");

    const { result } = renderHook(() => useRestoreVersion());
    await act(async () => {
      await result.current("page-1", "version-1", "user-2");
    });

    expect(await loadPendingEdit("page-1")).toBeNull();
    expect(getEditorRevision("page-1")).toBe(before + 1);
  });

  it("throws, and leaves the editor untouched, when the page update fails", async () => {
    pagesUpdate.mockImplementation(() => ({ eq: () => Promise.resolve({ error: { code: "42501", message: "denied" } }) }));
    const before = getEditorRevision("page-1");

    const { result } = renderHook(() => useRestoreVersion());
    await act(async () => {
      await expect(result.current("page-1", "version-1", "user-2")).rejects.toMatchObject({ code: "42501" });
    });

    expect(getEditorRevision("page-1")).toBe(before);
    expect(pagesStore.getState()[0].title).toBe("Current title");
  });

  it("throws for a version that is not loaded instead of silently doing nothing", async () => {
    const { result } = renderHook(() => useRestoreVersion());
    await act(async () => {
      await expect(result.current("page-1", "missing", "user-2")).rejects.toThrow(/tidak ditemukan/i);
    });
  });
});
