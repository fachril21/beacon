import { describe, it, expect } from "vitest";
import { isLegacyLexicalContent, normalizePageContent } from "./legacy-lexical-content";

function lexicalText(text: string) {
  return { mode: "normal", text, type: "text", style: "", detail: 0, format: 0, version: 1 };
}

describe("isLegacyLexicalContent", () => {
  it("detects the old Lexical {root:{...}} shape", () => {
    expect(isLegacyLexicalContent({ root: { type: "root", children: [] } })).toBe(true);
  });

  it("does not flag BlockNote's Block[] array as legacy", () => {
    expect(isLegacyLexicalContent([{ type: "paragraph", content: "hi" }])).toBe(false);
  });

  it("does not flag null/undefined as legacy", () => {
    expect(isLegacyLexicalContent(null)).toBe(false);
    expect(isLegacyLexicalContent(undefined)).toBe(false);
  });
});

describe("normalizePageContent", () => {
  it("passes already-BlockNote content through unchanged", () => {
    const content = [{ type: "paragraph", content: "hi" }];
    expect(normalizePageContent(content)).toBe(content);
  });

  it("converts a legacy heading + paragraph + code block", () => {
    const legacy = {
      root: {
        type: "root",
        children: [
          { type: "heading", tag: "h2", children: [lexicalText("Judul")] },
          { type: "paragraph", children: [lexicalText("Isi paragraf")] },
          { type: "code", language: "bash", children: [lexicalText("echo hi")] },
        ],
      },
    };

    expect(normalizePageContent(legacy)).toEqual([
      { type: "heading", props: { level: 2 }, content: "Judul" },
      { type: "paragraph", content: "Isi paragraf" },
      { type: "codeBlock", props: { language: "bash" }, content: "echo hi" },
    ]);
  });

  it("converts a legacy checklist, preserving checked state", () => {
    const legacy = {
      root: {
        type: "root",
        children: [
          {
            type: "list",
            listType: "check",
            children: [
              { type: "listitem", checked: true, children: [lexicalText("Selesai")] },
              { type: "listitem", checked: false, children: [lexicalText("Belum")] },
            ],
          },
        ],
      },
    };

    expect(normalizePageContent(legacy)).toEqual([
      { type: "checkListItem", content: "Selesai", props: { checked: true } },
      { type: "checkListItem", content: "Belum", props: { checked: false } },
    ]);
  });

  it("converts a legacy screenshot-block node, preserving its screenshotBlockId reference", () => {
    const legacy = { root: { type: "root", children: [{ type: "screenshot-block", screenshotBlockId: "shot-1" }] } };
    expect(normalizePageContent(legacy)).toEqual([{ type: "screenshot", props: { screenshotBlockId: "shot-1" } }]);
  });

  it("falls back to a single empty paragraph for a legacy doc with no convertible content", () => {
    const legacy = { root: { type: "root", children: [] } };
    expect(normalizePageContent(legacy)).toEqual([{ type: "paragraph", content: "" }]);
  });
});
