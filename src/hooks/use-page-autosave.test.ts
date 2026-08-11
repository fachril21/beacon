import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import "fake-indexeddb/auto";
import { emptyDoc } from "@/lib/mock/blocknote-content";
import { loadPendingEdit, savePendingEdit, clearPendingEdit } from "@/lib/offline-buffer";

const updateContent = vi.fn();
vi.mock("@/hooks/use-pages", () => ({
  useUpdatePageContent: () => updateContent,
}));

const { usePageAutosave } = await import("./use-page-autosave");

// AUTOSAVE_DEBOUNCE_MS is 2500 in use-page-autosave.ts; these use real timers
// (fake-indexeddb needs real timer ticks to resolve its transactions, which
// vi.useFakeTimers() would freeze), so allow enough real wall-clock time.
const WAIT_TIMEOUT = 4000;

describe("usePageAutosave", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearPendingEdit("page-1");
  });

  it("on a failed save, persists the content to IndexedDB and shows the error status", async () => {
    updateContent.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => usePageAutosave("page-1"));

    const content = emptyDoc();
    act(() => result.current.scheduleSave(content));

    await waitFor(() => expect(result.current.status).toBe("error"), { timeout: WAIT_TIMEOUT });
    await waitFor(async () => expect(await loadPendingEdit("page-1")).toEqual(content), { timeout: WAIT_TIMEOUT });
  }, 10000);

  it("on a successful save, clears any previously buffered edit for this Page", async () => {
    await savePendingEdit("page-1", emptyDoc());
    updateContent.mockResolvedValue(undefined);
    const { result } = renderHook(() => usePageAutosave("page-1"));

    act(() => result.current.scheduleSave(emptyDoc()));

    await waitFor(() => expect(result.current.status).toBe("saved"), { timeout: WAIT_TIMEOUT });
    expect(await loadPendingEdit("page-1")).toBeNull();
  }, 10000);

  it("flushes a pre-existing buffered edit on mount (crash/reload recovery)", async () => {
    const buffered = emptyDoc();
    await savePendingEdit("page-1", buffered);
    updateContent.mockResolvedValue(undefined);

    renderHook(() => usePageAutosave("page-1"));

    await waitFor(() => expect(updateContent).toHaveBeenCalledWith("page-1", buffered), { timeout: WAIT_TIMEOUT });
    await waitFor(async () => expect(await loadPendingEdit("page-1")).toBeNull(), { timeout: WAIT_TIMEOUT });
  }, 10000);
});
