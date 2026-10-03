import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { bumpEditorRevision, getEditorRevision, useEditorRevision } from "./editor-revision-store";

describe("editor revision store", () => {
  it("starts every page at revision 0", () => {
    expect(getEditorRevision("never-bumped")).toBe(0);
  });

  it("bumps only the given page", () => {
    bumpEditorRevision("page-a");
    bumpEditorRevision("page-a");
    expect(getEditorRevision("page-a")).toBe(2);
    expect(getEditorRevision("page-b")).toBe(0);
  });

  it("re-renders subscribers when their page is bumped", () => {
    const { result } = renderHook(() => useEditorRevision("page-c"));
    expect(result.current).toBe(0);
    act(() => bumpEditorRevision("page-c"));
    expect(result.current).toBe(1);
  });
});
