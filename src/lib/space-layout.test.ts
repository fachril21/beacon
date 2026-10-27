import { describe, expect, it } from "vitest";
import {
  defaultSpaceLayout,
  mergeLayoutWithPages,
  movePageInLayout,
  normalizeSpaceLayout,
  orderedLayoutPages,
  sectionForPage,
} from "./space-layout";
import type { Page, SpaceLayout } from "./types";

function makePage(id: string, overrides: Partial<Page> = {}): Page {
  return {
    id,
    spaceId: "space-1",
    parentPageId: null,
    title: id,
    description: "",
    emoji: null,
    order: 0,
    content: [],
    visibility: "internal",
    slug: null,
    isPublished: false,
    publishedContentSnapshot: null,
    publishedAt: null,
    createdByUserId: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeSpaceLayout", () => {
  it("returns null for missing or malformed values so callers fall back to the page tree", () => {
    expect(normalizeSpaceLayout(null)).toBeNull();
    expect(normalizeSpaceLayout("nope")).toBeNull();
    expect(normalizeSpaceLayout({ version: 2, sections: [] })).toBeNull();
    expect(normalizeSpaceLayout({ sections: "nope" })).toBeNull();
  });

  it("clamps column counts and drops unusable Page entries", () => {
    const layout = normalizeSpaceLayout({
      version: 1,
      sections: [
        {
          id: "s1",
          title: "Panduan",
          columns: 99,
          pages: [{ pageId: "p1" }, { nope: true }, { pageId: "p2", colSpan: 9 }],
        },
      ],
    });

    expect(layout?.sections[0]).toMatchObject({
      id: "s1",
      title: "Panduan",
      columns: 4,
      pages: [{ pageId: "p1" }, { pageId: "p2", colSpan: 4 }],
    });
  });
});

describe("mergeLayoutWithPages", () => {
  it("builds a default section from the page tree when no layout exists", () => {
    const pages = [makePage("parent", { order: 0 }), makePage("child", { parentPageId: "parent", order: 0 })];
    expect(defaultSpaceLayout(pages).sections[0].pages.map((p) => p.pageId)).toEqual(["parent", "child"]);
  });

  it("drops deleted pages and appends pages created after the layout was saved", () => {
    const layout: SpaceLayout = {
      version: 1,
      sections: [{ id: "s1", title: "Mulai", columns: 2, pages: [{ pageId: "deleted" }, { pageId: "kept" }] }],
    };

    const merged = mergeLayoutWithPages(layout, [makePage("kept"), makePage("new-page")]);

    expect(merged.sections[0].pages.map((p) => p.pageId)).toEqual(["kept", "new-page"]);
  });

  it("never lists the same page twice", () => {
    const layout: SpaceLayout = {
      version: 1,
      sections: [
        { id: "s1", title: "A", columns: 1, pages: [{ pageId: "p1" }] },
        { id: "s2", title: "B", columns: 1, pages: [{ pageId: "p1" }] },
      ],
    };

    const merged = mergeLayoutWithPages(layout, [makePage("p1")]);
    expect(merged.sections.flatMap((section) => section.pages.map((p) => p.pageId))).toEqual(["p1"]);
  });
});

describe("movePageInLayout", () => {
  const layout: SpaceLayout = {
    version: 1,
    sections: [
      { id: "s1", title: "A", columns: 2, pages: [{ pageId: "p1" }, { pageId: "p2" }] },
      { id: "s2", title: "B", columns: 2, pages: [{ pageId: "p3" }] },
    ],
  };

  it("moves a page between sections at the requested index", () => {
    const moved = movePageInLayout(layout, "p2", "s2", 0);
    expect(moved.sections[0].pages.map((p) => p.pageId)).toEqual(["p1"]);
    expect(moved.sections[1].pages.map((p) => p.pageId)).toEqual(["p2", "p3"]);
    expect(sectionForPage(moved, "p2")?.id).toBe("s2");
  });

  it("reorders within the same section without duplicating the page", () => {
    const moved = movePageInLayout(layout, "p1", "s1", 1);
    expect(moved.sections[0].pages.map((p) => p.pageId)).toEqual(["p2", "p1"]);
  });
});

describe("orderedLayoutPages", () => {
  it("returns pages in the admin-defined navigation order", () => {
    const pages = [makePage("p1"), makePage("p2"), makePage("p3")];
    const layout: SpaceLayout = {
      version: 1,
      sections: [
        { id: "s1", title: "B", columns: 1, pages: [{ pageId: "p3" }, { pageId: "p1" }] },
        { id: "s2", title: "A", columns: 1, pages: [{ pageId: "p2" }] },
      ],
    };

    expect(orderedLayoutPages(layout, pages).map((page) => page.id)).toEqual(["p3", "p1", "p2"]);
  });
});
