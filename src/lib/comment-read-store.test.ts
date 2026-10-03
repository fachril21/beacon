import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { markCommentsRead, clearCommentReadMarks, lastReadAt, useCommentReadMarks } from "./comment-read-store";

describe("comment read store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearCommentReadMarks();
  });

  it("has no read time until something is marked read", () => {
    const { result } = renderHook(() => useCommentReadMarks());
    expect(lastReadAt(result.current, "me", "page-1", "block-1")).toBeUndefined();
  });

  it("remembers the read time per user, page and block", () => {
    const { result } = renderHook(() => useCommentReadMarks());
    act(() => markCommentsRead("me", "page-1", "block-1", "2026-01-02T00:00:00.000Z"));

    expect(lastReadAt(result.current, "me", "page-1", "block-1")).toBe("2026-01-02T00:00:00.000Z");
    expect(lastReadAt(result.current, "me", "page-1", "block-2")).toBeUndefined();
    expect(lastReadAt(result.current, "someone-else", "page-1", "block-1")).toBeUndefined();
  });

  it("only ever moves the read time forward", () => {
    const { result } = renderHook(() => useCommentReadMarks());
    act(() => markCommentsRead("me", "page-1", "block-1", "2026-01-05T00:00:00.000Z"));
    act(() => markCommentsRead("me", "page-1", "block-1", "2026-01-03T00:00:00.000Z"));
    expect(lastReadAt(result.current, "me", "page-1", "block-1")).toBe("2026-01-05T00:00:00.000Z");
  });

  it("persists to localStorage so it survives a reload", () => {
    act(() => markCommentsRead("me", "page-1", "block-1", "2026-01-02T00:00:00.000Z"));
    const raw = window.localStorage.getItem("beacon.commentReads.v1");
    expect(raw).toContain("2026-01-02T00:00:00.000Z");
  });
});
