import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { setVersionPreview, useVersionPreview, useIsVersionPreviewing } from "./version-preview-store";
import type { Version } from "@/lib/types";

const version = (id: string, pageId: string): Version => ({
  id,
  pageId,
  title: "Judul",
  content: [],
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  isRestoreOf: null,
});

describe("version preview store", () => {
  it("is not previewing by default", () => {
    const { result } = renderHook(() => useVersionPreview("page-x"));
    expect(result.current).toBeNull();
  });

  it("holds the previewed version for that page only, and clears on null", () => {
    const a = renderHook(() => useVersionPreview("page-a"));
    const b = renderHook(() => useIsVersionPreviewing("page-b"));
    const v = version("v-1", "page-a");

    act(() => setVersionPreview("page-a", v));
    expect(a.result.current).toBe(v);
    expect(b.result.current).toBe(false);

    act(() => setVersionPreview("page-a", null));
    expect(a.result.current).toBeNull();
  });
});
