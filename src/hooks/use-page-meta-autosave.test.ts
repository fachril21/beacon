import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { bumpEditorRevision } from "@/lib/editor-revision-store";

const updateMeta = vi.fn(() => Promise.resolve());
vi.mock("@/hooks/use-pages", () => ({
  useUpdatePageMeta: () => updateMeta,
}));

const { useDescriptionAutosave, usePageEmoji } = await import("./use-page-meta-autosave");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDescriptionAutosave", () => {
  it("adopts the loaded description once it arrives, even though it was undefined on first render", () => {
    const { result, rerender } = renderHook(({ loaded }) => useDescriptionAutosave("page-1", loaded), {
      initialProps: { loaded: undefined as string | undefined },
    });
    expect(result.current.description).toBe("");

    rerender({ loaded: "Ringkasan singkat" });
    expect(result.current.description).toBe("Ringkasan singkat");
  });

  it("debounces the write instead of saving on every keystroke", () => {
    const { result } = renderHook(() => useDescriptionAutosave("page-1", ""));

    act(() => result.current.scheduleDescriptionSave("Satu"));
    act(() => result.current.scheduleDescriptionSave("Dua"));
    act(() => vi.advanceTimersByTime(799));
    expect(updateMeta).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(updateMeta).toHaveBeenCalledTimes(1);
    expect(updateMeta).toHaveBeenCalledWith("page-1", { description: "Dua" });
  });

  it("flushes a pending write on unmount so navigating away never drops it", () => {
    const { result, unmount } = renderHook(() => useDescriptionAutosave("page-away", ""));

    act(() => result.current.scheduleDescriptionSave("Belum tersimpan"));
    expect(updateMeta).not.toHaveBeenCalled();

    unmount();
    expect(updateMeta).toHaveBeenCalledWith("page-away", { description: "Belum tersimpan" });
  });

  it("re-syncs (and drops the pending write) when a version restore bumps the editor revision", () => {
    const { result, rerender } = renderHook(({ loaded }) => useDescriptionAutosave("page-restore", loaded), {
      initialProps: { loaded: "Sebelum restore" },
    });
    act(() => result.current.scheduleDescriptionSave("Ketikan yang belum tersimpan"));

    rerender({ loaded: "Setelah restore" });
    act(() => bumpEditorRevision("page-restore"));

    expect(result.current.description).toBe("Setelah restore");
    act(() => vi.advanceTimersByTime(2000));
    expect(updateMeta).not.toHaveBeenCalledWith("page-restore", { description: "Ketikan yang belum tersimpan" });
  });

  it("reports a rejected write instead of failing silently", async () => {
    updateMeta.mockRejectedValueOnce(new Error("rls"));
    const onError = vi.fn();
    const { result } = renderHook(() => useDescriptionAutosave("page-1", "", onError));

    act(() => result.current.scheduleDescriptionSave("Judul draft"));
    act(() => vi.advanceTimersByTime(1000));
    // The rejected write resolves on a microtask, not a timer.
    await act(async () => {});
    expect(onError).toHaveBeenCalled();
  });
});

describe("usePageEmoji", () => {
  it("starts unset for a brand-new Page, so nothing renders as a placeholder emoji", () => {
    const { result } = renderHook(() => usePageEmoji("page-1", null));
    expect(result.current.emoji).toBeNull();
  });

  it("writes the chosen emoji immediately — one click, one save", async () => {
    const { result } = renderHook(() => usePageEmoji("page-1", null));

    await act(async () => result.current.saveEmoji("📘"));
    expect(updateMeta).toHaveBeenCalledWith("page-1", { emoji: "📘" });
    expect(result.current.emoji).toBe("📘");
  });

  it("clears the emoji back to null so listings can drop it entirely", async () => {
    const { result } = renderHook(() => usePageEmoji("page-1", "📘"));

    await act(async () => result.current.saveEmoji(null));
    expect(updateMeta).toHaveBeenCalledWith("page-1", { emoji: null });
    expect(result.current.emoji).toBeNull();
  });

  it("rolls the picker back to the last persisted emoji and reports the failure", async () => {
    updateMeta.mockRejectedValueOnce(new Error("rls"));
    const onError = vi.fn();
    const { result } = renderHook(() => usePageEmoji("page-1", "📘", onError));

    await act(async () => result.current.saveEmoji("🔥"));
    expect(result.current.emoji).toBe("📘");
    expect(onError).toHaveBeenCalled();
  });

  it("re-syncs from the loaded Page when a version restore bumps the revision", () => {
    const { result, rerender } = renderHook(({ loaded }) => usePageEmoji("page-emoji", loaded), {
      initialProps: { loaded: null as string | null },
    });

    rerender({ loaded: "🚀" });
    act(() => bumpEditorRevision("page-emoji"));

    expect(result.current.emoji).toBe("🚀");
  });
});
