import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { focusBlockComments, clearBlockCommentFocus, focusComment, clearCommentHighlight, useCommentFocus } from "./comment-focus-store";

describe("comment focus store", () => {
  it("starts with no focused block", () => {
    const { result } = renderHook(() => useCommentFocus("page-none"));
    expect(result.current).toEqual({ blockId: null, nonce: 0, highlightedCommentId: null });
  });

  it("focuses a block of one page and bumps the nonce on every request, even for the same block", () => {
    const a = renderHook(() => useCommentFocus("page-a"));
    const b = renderHook(() => useCommentFocus("page-b"));

    act(() => focusBlockComments("page-a", "block-1"));
    const first = a.result.current.nonce;
    expect(a.result.current.blockId).toBe("block-1");
    expect(b.result.current.blockId).toBeNull();

    act(() => focusBlockComments("page-a", "block-1"));
    expect(a.result.current.nonce).toBe(first + 1);
  });

  it("clears the block filter", () => {
    const a = renderHook(() => useCommentFocus("page-c"));
    act(() => focusBlockComments("page-c", "block-1"));
    act(() => clearBlockCommentFocus("page-c"));
    expect(a.result.current.blockId).toBeNull();
  });

  it("focusComment narrows to the comment's block, highlights that comment and asks for the panel (nonce)", () => {
    const a = renderHook(() => useCommentFocus("page-d"));
    act(() => focusComment("page-d", "c-1", "block-9"));
    expect(a.result.current).toMatchObject({ blockId: "block-9", highlightedCommentId: "c-1" });
    expect(a.result.current.nonce).toBe(1);
  });

  it("focusComment on a page-level comment shows all comments (no block filter) but still highlights it", () => {
    const a = renderHook(() => useCommentFocus("page-e"));
    act(() => focusComment("page-e", "c-2", null));
    expect(a.result.current).toMatchObject({ blockId: null, highlightedCommentId: "c-2" });
    expect(a.result.current.nonce).toBe(1);
  });

  it("clearCommentHighlight removes only the highlight", () => {
    const a = renderHook(() => useCommentFocus("page-f"));
    act(() => focusComment("page-f", "c-3", "block-1"));
    act(() => clearCommentHighlight("page-f"));
    expect(a.result.current).toMatchObject({ blockId: "block-1", highlightedCommentId: null });
  });
});
