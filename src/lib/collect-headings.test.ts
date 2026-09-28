import { describe, it, expect } from "vitest";
import { collectHeadings } from "./collect-headings";
import type { PageContent } from "./types";

describe("collectHeadings", () => {
  it("returns non-empty headings in document order, including nested children, with their level", () => {
    const content = [
      { id: "h1", type: "heading", props: { level: 1 }, content: [{ type: "text", text: "Intro", styles: {} }] },
      { id: "p1", type: "paragraph", content: [{ type: "text", text: "body", styles: {} }] },
      {
        id: "s1",
        type: "stepper",
        children: [{ id: "h3", type: "heading", props: { level: 3 }, content: [{ type: "text", text: "Nested", styles: {} }] }],
      },
      { id: "empty", type: "heading", props: { level: 2 }, content: [] },
    ] as unknown as PageContent;

    expect(collectHeadings(content)).toEqual([
      { id: "h1", text: "Intro", level: 1 },
      { id: "h3", text: "Nested", level: 3 },
    ]);
  });

  it("defaults a heading with no level prop to level 1", () => {
    const content = [{ id: "h", type: "heading", content: [{ type: "text", text: "X", styles: {} }] }] as unknown as PageContent;
    expect(collectHeadings(content)[0].level).toBe(1);
  });
});
