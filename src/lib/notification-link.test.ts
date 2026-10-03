import { describe, it, expect } from "vitest";
import { notificationHref, commentSnippet } from "./notification-link";

describe("notificationHref", () => {
  it("links to the page with the tagging comment in the query so the page can open it", () => {
    expect(notificationHref({ spaceId: "space-1", pageId: "page-1" }, "comment-9")).toBe(
      "/spaces/space-1/pages/page-1?comment=comment-9",
    );
  });

  it("has no safe target when the page is not known", () => {
    expect(notificationHref(undefined, "comment-9")).toBeNull();
  });
});

describe("commentSnippet", () => {
  it("returns the comment text collapsed onto one line", () => {
    expect(commentSnippet("Halo\n  @sari   tolong cek")).toBe("Halo @sari tolong cek");
  });

  it("truncates long comments with an ellipsis", () => {
    const snippet = commentSnippet("a".repeat(200), 20);
    expect(snippet).toHaveLength(21);
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("is empty for a missing comment", () => {
    expect(commentSnippet(undefined)).toBe("");
    expect(commentSnippet(null)).toBe("");
  });
});
