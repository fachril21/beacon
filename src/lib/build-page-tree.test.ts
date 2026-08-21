import { describe, it, expect } from "vitest";
import { buildPageTree, flattenPageTree } from "./build-page-tree";
import type { Page } from "@/lib/types";

function makePage(overrides: Partial<Page> & Pick<Page, "id">): Page {
  return {
    spaceId: "space-1",
    parentPageId: null,
    title: `Page ${overrides.id}`,
    order: 0,
    content: [],
    visibility: "publishable",
    slug: overrides.id,
    isPublished: true,
    publishedContentSnapshot: null,
    publishedAt: "2026-01-01T00:00:00.000Z",
    createdByUserId: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildPageTree", () => {
  it("returns an empty array for no pages", () => {
    expect(buildPageTree([])).toEqual([]);
  });

  it("returns a single root page with no children", () => {
    const root = makePage({ id: "root", parentPageId: null, order: 0 });
    const tree = buildPageTree([root]);
    expect(tree).toEqual([{ page: root, children: [] }]);
  });

  it("nests a child page under its parent instead of listing it flat", () => {
    const parent = makePage({ id: "parent", parentPageId: null, order: 0 });
    const child = makePage({ id: "child", parentPageId: "parent", order: 0 });
    const tree = buildPageTree([parent, child]);

    expect(tree).toHaveLength(1);
    expect(tree[0].page.id).toBe("parent");
    expect(tree[0].children).toEqual([{ page: child, children: [] }]);
  });

  it("sorts sibling root pages by their own order, not array/insertion order", () => {
    const second = makePage({ id: "second", parentPageId: null, order: 1 });
    const first = makePage({ id: "first", parentPageId: null, order: 0 });
    const tree = buildPageTree([second, first]);
    expect(tree.map((n) => n.page.id)).toEqual(["first", "second"]);
  });

  it("sorts children by their sibling-scoped order independently of the parent's order", () => {
    const parent = makePage({ id: "parent", parentPageId: null, order: 5 });
    const childB = makePage({ id: "child-b", parentPageId: "parent", order: 1 });
    const childA = makePage({ id: "child-a", parentPageId: "parent", order: 0 });
    const tree = buildPageTree([parent, childB, childA]);

    expect(tree[0].children.map((n) => n.page.id)).toEqual(["child-a", "child-b"]);
  });

  it("nests multiple levels deep (grandchildren)", () => {
    const root = makePage({ id: "root", parentPageId: null, order: 0 });
    const child = makePage({ id: "child", parentPageId: "root", order: 0 });
    const grandchild = makePage({ id: "grandchild", parentPageId: "child", order: 0 });
    const tree = buildPageTree([root, child, grandchild]);

    expect(tree[0].children[0].page.id).toBe("child");
    expect(tree[0].children[0].children[0].page.id).toBe("grandchild");
  });

  it("hides a published page whose parent is not in the published set, instead of promoting it to root", () => {
    // "parent" is not published (absent from the input array) — "child" must
    // not appear anywhere in the tree, not even at the root level.
    const child = makePage({ id: "child", parentPageId: "unpublished-parent", order: 0 });
    const otherRoot = makePage({ id: "other-root", parentPageId: null, order: 0 });
    const tree = buildPageTree([child, otherRoot]);

    expect(tree).toEqual([{ page: otherRoot, children: [] }]);
  });

  it("cascades hiding to descendants of an orphaned page, even if those descendants are themselves published", () => {
    // "child" is orphaned (its parent isn't published); "grandchild" is a
    // published child of "child" and must also be hidden as a result.
    const child = makePage({ id: "child", parentPageId: "unpublished-parent", order: 0 });
    const grandchild = makePage({ id: "grandchild", parentPageId: "child", order: 0 });
    const tree = buildPageTree([child, grandchild]);

    expect(tree).toEqual([]);
  });
});

describe("flattenPageTree", () => {
  it("returns an empty array for an empty tree", () => {
    expect(flattenPageTree([])).toEqual([]);
  });

  it("annotates each page with its depth, in tree (parent-before-child) order", () => {
    const root = makePage({ id: "root", parentPageId: null, order: 0 });
    const child = makePage({ id: "child", parentPageId: "root", order: 0 });
    const grandchild = makePage({ id: "grandchild", parentPageId: "child", order: 0 });
    const tree = buildPageTree([grandchild, child, root]);

    expect(flattenPageTree(tree)).toEqual([
      { page: root, depth: 0 },
      { page: child, depth: 1 },
      { page: grandchild, depth: 2 },
    ]);
  });

  it("keeps sibling subtrees in order without interleaving them", () => {
    const root = makePage({ id: "root", parentPageId: null, order: 0 });
    const childA = makePage({ id: "child-a", parentPageId: "root", order: 0 });
    const childB = makePage({ id: "child-b", parentPageId: "root", order: 1 });
    const grandchildOfA = makePage({ id: "grandchild-of-a", parentPageId: "child-a", order: 0 });
    const tree = buildPageTree([root, childB, childA, grandchildOfA]);

    expect(flattenPageTree(tree).map((entry) => entry.page.id)).toEqual(["root", "child-a", "grandchild-of-a", "child-b"]);
  });
});
