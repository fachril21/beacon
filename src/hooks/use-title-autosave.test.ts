import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const updateTitle = vi.fn();
vi.mock("@/hooks/use-pages", () => ({
  useUpdatePageTitle: () => updateTitle,
}));

const { useTitleAutosave } = await import("./use-title-autosave");

describe("useTitleAutosave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("syncing the local title from the loaded Page", () => {
    it("adopts the loaded title once it arrives, even though it was undefined on first render", () => {
      const { result, rerender } = renderHook(({ loadedTitle }) => useTitleAutosave("page-1", loadedTitle), {
        initialProps: { loadedTitle: undefined as string | undefined },
      });

      // Matches the real usePage() timing: undefined on the render right
      // after a hard reload, before the async fetch resolves.
      expect(result.current.title).toBe("");

      rerender({ loadedTitle: "Existing Title From DB" });
      expect(result.current.title).toBe("Existing Title From DB");
    });

    it("re-syncs when navigating to a different Page", () => {
      const { result, rerender } = renderHook(({ pageId, loadedTitle }) => useTitleAutosave(pageId, loadedTitle), {
        initialProps: { pageId: "page-1", loadedTitle: "Page One" },
      });
      expect(result.current.title).toBe("Page One");

      rerender({ pageId: "page-2", loadedTitle: "Page Two" });
      expect(result.current.title).toBe("Page Two");
    });

    it("does not clobber an in-progress unsaved edit if the store re-emits the same Page's stale title", () => {
      const { result, rerender } = renderHook(({ loadedTitle }) => useTitleAutosave("page-1", loadedTitle), {
        initialProps: { loadedTitle: "Original" },
      });

      act(() => result.current.scheduleTitleSave("Original Edited"));
      expect(result.current.title).toBe("Original Edited");

      // Same pageId reloads with the pre-edit title (e.g. an unrelated
      // store refresh) — must not stomp on what the user is typing.
      rerender({ loadedTitle: "Original" });
      expect(result.current.title).toBe("Original Edited");
    });
  });

  it("debounces rapid keystrokes into a single save with the latest title", async () => {
    updateTitle.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTitleAutosave("page-1", ""));

    act(() => {
      result.current.scheduleTitleSave("H");
      result.current.scheduleTitleSave("He");
      result.current.scheduleTitleSave("Hello");
    });

    expect(result.current.title).toBe("Hello");
    expect(updateTitle).not.toHaveBeenCalled();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(updateTitle).toHaveBeenCalledTimes(1);
    expect(updateTitle).toHaveBeenCalledWith("page-1", "Hello");
  });

  it("calls onError instead of throwing when the debounced save fails, so a failure is never silent", async () => {
    const error = new Error("RLS violation");
    updateTitle.mockRejectedValue(error);
    const onError = vi.fn();
    const { result } = renderHook(() => useTitleAutosave("page-1", "", onError));

    act(() => {
      result.current.scheduleTitleSave("Untitled becomes Titled");
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(onError).toHaveBeenCalledWith(error);
  });

  it("flushTitleSave persists immediately and cancels the pending debounce timer", async () => {
    updateTitle.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTitleAutosave("page-1", ""));

    act(() => {
      result.current.scheduleTitleSave("Saved on blur");
    });
    await act(async () => {
      await result.current.flushTitleSave();
    });

    expect(updateTitle).toHaveBeenCalledTimes(1);
    expect(updateTitle).toHaveBeenCalledWith("page-1", "Saved on blur");

    // Advancing timers afterward must not fire a second, stale save.
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(updateTitle).toHaveBeenCalledTimes(1);
  });

  it("flushes a pending edit on unmount, so navigating away right after typing doesn't drop it", async () => {
    updateTitle.mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useTitleAutosave("page-1", ""));

    act(() => {
      result.current.scheduleTitleSave("Typed then immediately navigated away");
    });
    unmount();
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(updateTitle).toHaveBeenCalledWith("page-1", "Typed then immediately navigated away");
  });

  it("does nothing on flush/unmount when there is no pending edit", async () => {
    updateTitle.mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useTitleAutosave("page-1", ""));

    await act(async () => {
      await result.current.flushTitleSave();
    });
    unmount();

    expect(updateTitle).not.toHaveBeenCalled();
  });
});
