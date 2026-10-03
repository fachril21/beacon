import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { CommentedBlockCues } from "./commented-block-cues";
import { markCommentsRead, clearCommentReadMarks } from "@/lib/comment-read-store";
import type { Comment, Page, PageContent } from "@/lib/types";

const comments: Comment[] = [];
vi.mock("@/hooks/use-comments", () => ({ usePageComments: () => [...comments] }));
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: { id: "me" } }) }));

const page = {
  id: "page-1",
  content: [{ id: "b-text", type: "paragraph", content: [] }] as unknown as PageContent,
} as unknown as Page;

const incoming = (createdAt: string, authorUserId = "other"): Comment => ({
  id: createdAt,
  pageId: "page-1",
  blockId: "b-text",
  authorUserId,
  body: "x",
  mentionedUserIds: [],
  createdAt,
});

describe("CommentedBlockCues", () => {
  beforeEach(() => {
    comments.length = 0;
    window.localStorage.clear();
    clearCommentReadMarks();
  });

  it("marks a block that has an unread comment from someone else", () => {
    comments.push(incoming("2026-01-02T00:00:00.000Z"));
    const { container } = render(<CommentedBlockCues page={page} />);
    expect(container.querySelector("style")?.textContent).toContain('[data-id="b-text"]');
  });

  it("renders nothing when there are no comments, or only the user's own", () => {
    const { container, rerender } = render(<CommentedBlockCues page={page} />);
    expect(container.querySelector("style")).toBeNull();

    comments.push(incoming("2026-01-02T00:00:00.000Z", "me"));
    rerender(<CommentedBlockCues page={page} />);
    expect(container.querySelector("style")).toBeNull();
  });

  it("removes the marker once the comments have been read", () => {
    comments.push(incoming("2026-01-02T00:00:00.000Z"));
    const { container } = render(<CommentedBlockCues page={page} />);
    expect(container.querySelector("style")).not.toBeNull();

    act(() => markCommentsRead("me", "page-1", "b-text", "2026-01-02T00:00:00.000Z"));
    expect(container.querySelector("style")).toBeNull();
  });

  it("brings the marker back when a newer comment arrives after reading", () => {
    comments.push(incoming("2026-01-02T00:00:00.000Z"));
    act(() => markCommentsRead("me", "page-1", "b-text", "2026-01-02T00:00:00.000Z"));
    const { container, rerender } = render(<CommentedBlockCues page={page} />);
    expect(container.querySelector("style")).toBeNull();

    comments.push(incoming("2026-01-03T00:00:00.000Z"));
    rerender(<CommentedBlockCues page={page} />);
    expect(container.querySelector("style")).not.toBeNull();
  });
});
