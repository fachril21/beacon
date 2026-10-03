import { describe, it, expect } from "vitest";
import { unreadBlockCounts, commentCueCss, findAnchorBlock } from "./comment-anchors";
import type { Comment, PageContent } from "@/lib/types";

const content = [
  { id: "b-text", type: "paragraph", content: [] },
  { id: "b-shot", type: "screenshot", props: { screenshotBlockId: "shot-1" } },
  { id: "b-parent", type: "paragraph", content: [], children: [{ id: "b-child", type: "paragraph", content: [] }] },
] as unknown as PageContent;

const comment = (blockId: string, id = blockId, overrides: Partial<Comment> = {}): Comment => ({
  id,
  pageId: "page-1",
  blockId,
  authorUserId: "other",
  body: "x",
  mentionedUserIds: [],
  createdAt: "2026-01-02T00:00:00.000Z",
  ...overrides,
});
const neverRead = () => undefined;

describe("findAnchorBlock", () => {
  it("finds a block by its own id, by its screenshot id, and inside children", () => {
    expect(findAnchorBlock(content, "b-text")?.id).toBe("b-text");
    expect(findAnchorBlock(content, "shot-1")?.id).toBe("b-shot");
    expect(findAnchorBlock(content, "b-child")?.id).toBe("b-child");
  });

  it("returns null for the page-level pseudo block and for unknown ids", () => {
    expect(findAnchorBlock(content, "page")).toBeNull();
    expect(findAnchorBlock(content, "gone")).toBeNull();
  });
});

describe("unreadBlockCounts", () => {
  it("counts unread comments per editor block, mapping a screenshot comment onto its block", () => {
    const counts = unreadBlockCounts(content, [comment("b-text", "1"), comment("b-text", "2"), comment("shot-1", "3")], neverRead, "me");
    expect(counts.get("b-text")).toBe(2);
    expect(counts.get("b-shot")).toBe(1);
  });

  it("does not count the current user's own comments", () => {
    const counts = unreadBlockCounts(content, [comment("b-text", "1", { authorUserId: "me" })], neverRead, "me");
    expect(counts.size).toBe(0);
  });

  it("does not count comments at or before the block's last-read time, but does count newer ones", () => {
    const readAt = (blockId: string) => (blockId === "b-text" ? "2026-01-02T00:00:00.000Z" : undefined);
    const counts = unreadBlockCounts(
      content,
      [comment("b-text", "1"), comment("b-text", "2", { createdAt: "2026-01-03T00:00:00.000Z" }), comment("shot-1", "3")],
      readAt,
      "me",
    );
    expect(counts.get("b-text")).toBe(1);
    expect(counts.get("b-shot")).toBe(1);
  });

  it("ignores page-level comments and comments whose block no longer exists", () => {
    const counts = unreadBlockCounts(content, [comment("page"), comment("deleted-block")], neverRead, "me");
    expect(counts.size).toBe(0);
  });
});

describe("commentCueCss", () => {
  it("is empty when no block has comments", () => {
    expect(commentCueCss([])).toBe("");
  });

  it("targets each block's own content, not its nested children", () => {
    const css = commentCueCss(["b-text"]);
    expect(css).toContain('[data-id="b-text"] > .bn-block-content');
    expect(css).toContain('[data-id="b-text"] > .bn-block > .bn-block-content');
  });

  it("draws the marker in the right margin, outside the text, and never tints or outlines the text itself", () => {
    const css = commentCueCss(["b-text"]);
    expect(css).toContain("::after");
    expect(css).toMatch(/right:\s*-\d/);
    expect(css).not.toContain("box-shadow");
    expect(css).not.toContain("background-color");
  });

  it("drops ids that are not safe to put in a selector", () => {
    expect(commentCueCss(['bad"] { color: red } [x="'])).toBe("");
  });
});
