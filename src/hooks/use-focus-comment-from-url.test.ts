import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useCommentFocus } from "@/lib/comment-focus-store";
import type { Comment } from "@/lib/types";

let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => "/spaces/space-1/pages/page-1",
}));

const comments: Comment[] = [];
vi.mock("@/hooks/use-comments", () => ({ usePageComments: () => [...comments] }));

const { useFocusCommentFromUrl } = await import("./use-focus-comment-from-url");

const comment = (id: string, blockId: string): Comment => ({
  id,
  pageId: "page-1",
  blockId,
  authorUserId: "u",
  body: "x",
  mentionedUserIds: [],
  createdAt: "t",
});

describe("useFocusCommentFromUrl", () => {
  beforeEach(() => {
    comments.length = 0;
    search = "";
    window.history.replaceState(null, "", "/spaces/space-1/pages/page-1");
  });

  it("does nothing without a ?comment= parameter", () => {
    const focus = renderHook(() => useCommentFocus("page-t1"));
    renderHook(() => useFocusCommentFromUrl("page-t1"));
    expect(focus.result.current.highlightedCommentId).toBeNull();
  });

  it("focuses the comment's block and highlights the comment, then removes the parameter from the URL", () => {
    search = "comment=c-1";
    window.history.replaceState(null, "", "/spaces/space-1/pages/page-1?comment=c-1");
    comments.push(comment("c-1", "block-7"));
    const focus = renderHook(() => useCommentFocus("page-t2"));

    renderHook(() => useFocusCommentFromUrl("page-t2"));

    expect(focus.result.current).toMatchObject({ blockId: "block-7", highlightedCommentId: "c-1" });
    expect(window.location.search).toBe("");
  });

  it("shows all comments for a page-level comment", () => {
    search = "comment=c-2";
    comments.push(comment("c-2", "page"));
    const focus = renderHook(() => useCommentFocus("page-t3"));

    renderHook(() => useFocusCommentFromUrl("page-t3"));

    expect(focus.result.current).toMatchObject({ blockId: null, highlightedCommentId: "c-2" });
  });

  it("waits for the comment to load instead of giving up", () => {
    search = "comment=c-3";
    window.history.replaceState(null, "", "/spaces/space-1/pages/page-1?comment=c-3");
    const focus = renderHook(() => useCommentFocus("page-t4"));
    const hook = renderHook(() => useFocusCommentFromUrl("page-t4"));
    expect(focus.result.current.highlightedCommentId).toBeNull();
    expect(window.location.search).toBe("?comment=c-3");

    comments.push(comment("c-3", "block-1"));
    hook.rerender();
    expect(focus.result.current.highlightedCommentId).toBe("c-3");
  });
});
