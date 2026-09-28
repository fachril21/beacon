import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { getAnnotationFocusBlockId, openAnnotationFocus, closeAnnotationFocus, useAnnotationFocusBlockId } from "./annotation-focus-store";

describe("annotation focus store", () => {
  it("starts with no block focused", () => {
    closeAnnotationFocus();
    expect(getAnnotationFocusBlockId()).toBeNull();
  });

  it("opens focus mode for a given block id", () => {
    openAnnotationFocus("block-1");
    expect(getAnnotationFocusBlockId()).toBe("block-1");
  });

  it("opening a different block replaces the previously focused one, not merges", () => {
    openAnnotationFocus("block-1");
    openAnnotationFocus("block-2");
    expect(getAnnotationFocusBlockId()).toBe("block-2");
  });

  it("closes back to null", () => {
    openAnnotationFocus("block-1");
    closeAnnotationFocus();
    expect(getAnnotationFocusBlockId()).toBeNull();
  });
});

describe("useAnnotationFocusBlockId", () => {
  it("reads the current focused block id and stays in sync with external updates", () => {
    closeAnnotationFocus();
    const { result } = renderHook(() => useAnnotationFocusBlockId());
    expect(result.current).toBeNull();

    act(() => {
      openAnnotationFocus("block-hook-1");
    });
    expect(result.current).toBe("block-hook-1");

    act(() => {
      closeAnnotationFocus();
    });
    expect(result.current).toBeNull();
  });
});
