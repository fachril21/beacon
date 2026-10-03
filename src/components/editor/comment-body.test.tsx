import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommentBody } from "./comment-body";
import type { Comment } from "@/lib/types";

// A profile whose name was never filled in: the mention text is the full email.
vi.mock("@/hooks/use-users", () => ({
  useUsers: () => [{ id: "u2", name: "", email: "sari.dewi@example.com" }],
}));

const comment: Comment = {
  id: "c1",
  pageId: "page-1",
  blockId: "b1",
  authorUserId: "u1",
  body: "Tolong cek @sari.dewi@example.com ya",
  mentionedUserIds: ["u2"],
  createdAt: "2026-01-02T00:00:00.000Z",
};

describe("CommentBody", () => {
  it("highlights a mention of someone whose profile has no name, by their full email", () => {
    render(<CommentBody comment={comment} />);
    expect(screen.getByText("@sari.dewi@example.com")).toHaveAttribute("data-mention", "true");
  });
});
