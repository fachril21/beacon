import { describe, it, expect } from "vitest";
import { contentFingerprint } from "./content-fingerprint";
import type { PageContent } from "@/lib/types";

const text = (value: string) => [{ type: "text", text: value, styles: {} }];
const para = (value: string, id = "p") => ({
  id,
  type: "paragraph",
  props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
  content: value ? text(value) : [],
  children: [],
});
const doc = (...blocks: unknown[]) => blocks as unknown as PageContent;

describe("contentFingerprint", () => {
  it("is equal for identical content", () => {
    expect(contentFingerprint(doc(para("Halo")))).toBe(contentFingerprint(doc(para("Halo"))));
  });

  it("changes when the visible text changes", () => {
    expect(contentFingerprint(doc(para("Halo")))).not.toBe(contentFingerprint(doc(para("Halo dunia"))));
  });

  it("ignores block ids", () => {
    expect(contentFingerprint(doc(para("Halo", "a")))).toBe(contentFingerprint(doc(para("Halo", "b"))));
  });

  it("ignores trailing empty paragraphs (clicking a new line without typing)", () => {
    const base = contentFingerprint(doc(para("Halo")));
    expect(contentFingerprint(doc(para("Halo"), para("")))).toBe(base);
    expect(contentFingerprint(doc(para("Halo"), para(""), para("")))).toBe(base);
  });

  it("keeps an empty paragraph that sits between content", () => {
    expect(contentFingerprint(doc(para("A"), para(""), para("B")))).not.toBe(contentFingerprint(doc(para("A"), para("B"))));
  });

  it("ignores default props and empty styles that BlockNote fills in", () => {
    const partial = { type: "paragraph", content: "Halo" };
    expect(contentFingerprint(doc(partial))).toBe(contentFingerprint(doc(para("Halo"))));
  });

  it("is equal again after text is added and removed (undo)", () => {
    const original = contentFingerprint(doc(para("Halo")));
    const edited = contentFingerprint(doc(para("Halo some text")));
    const undone = contentFingerprint(doc(para("Halo")));
    expect(edited).not.toBe(original);
    expect(undone).toBe(original);
  });

  it("treats a real non-default prop change as a change", () => {
    const heading = (level: number) => ({ type: "heading", props: { level }, content: text("Judul") });
    expect(contentFingerprint(doc(heading(1)))).not.toBe(contentFingerprint(doc(heading(2))));
  });

  it("does not throw on null or non-array content", () => {
    expect(() => contentFingerprint(null)).not.toThrow();
    expect(contentFingerprint(null)).toBe(contentFingerprint([]));
  });
});
