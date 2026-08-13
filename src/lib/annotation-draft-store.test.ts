import { describe, it, expect } from "vitest";
import {
  getAnnotationDraft,
  setAnnotationDraft,
  clearAnnotationDraft,
  getAnnotationToolState,
  setAnnotationToolState,
  clearAnnotationToolState,
} from "./annotation-draft-store";
import type { AnnotationJson } from "./types";

function makeDraft(overrides: Partial<AnnotationJson> = {}): AnnotationJson {
  return { version: "7.0", objects: [], nextMarkerNumber: 1, ...overrides };
}

describe("annotation draft store", () => {
  it("returns undefined for a block with no draft", () => {
    expect(getAnnotationDraft("block-none")).toBeUndefined();
  });

  it("returns the draft that was set for a block", () => {
    const draft = makeDraft({ nextMarkerNumber: 3, objects: [{ type: "Circle" }] });
    setAnnotationDraft("block-a", draft);
    expect(getAnnotationDraft("block-a")).toEqual(draft);
  });

  it("overwrites a previous draft for the same block", () => {
    setAnnotationDraft("block-b", makeDraft({ nextMarkerNumber: 1 }));
    setAnnotationDraft("block-b", makeDraft({ nextMarkerNumber: 2 }));
    expect(getAnnotationDraft("block-b")?.nextMarkerNumber).toBe(2);
  });

  it("keeps drafts for different blocks independent", () => {
    setAnnotationDraft("block-c1", makeDraft({ nextMarkerNumber: 5 }));
    setAnnotationDraft("block-c2", makeDraft({ nextMarkerNumber: 9 }));
    expect(getAnnotationDraft("block-c1")?.nextMarkerNumber).toBe(5);
    expect(getAnnotationDraft("block-c2")?.nextMarkerNumber).toBe(9);
  });

  it("removes the draft for a block on clear, leaving other blocks' drafts intact", () => {
    setAnnotationDraft("block-d1", makeDraft());
    setAnnotationDraft("block-d2", makeDraft());
    clearAnnotationDraft("block-d1");
    expect(getAnnotationDraft("block-d1")).toBeUndefined();
    expect(getAnnotationDraft("block-d2")).toBeDefined();
  });

  it("clearing a block with no draft is a no-op", () => {
    expect(() => clearAnnotationDraft("block-missing")).not.toThrow();
    expect(getAnnotationDraft("block-missing")).toBeUndefined();
  });
});

describe("annotation tool selection state", () => {
  it("returns undefined for a block with no stored tool state", () => {
    expect(getAnnotationToolState("tool-none")).toBeUndefined();
  });

  it("returns the active tool and color that were set for a block", () => {
    setAnnotationToolState("tool-a", { activeTool: "marker", activeColor: "#ff0000" });
    expect(getAnnotationToolState("tool-a")).toEqual({ activeTool: "marker", activeColor: "#ff0000" });
  });

  it("overwrites a previous tool state for the same block", () => {
    setAnnotationToolState("tool-b", { activeTool: "box", activeColor: "#ff0000" });
    setAnnotationToolState("tool-b", { activeTool: null, activeColor: "#00ff00" });
    expect(getAnnotationToolState("tool-b")).toEqual({ activeTool: null, activeColor: "#00ff00" });
  });

  it("removes the tool state for a block on clear, leaving other blocks intact", () => {
    setAnnotationToolState("tool-c1", { activeTool: "arrow", activeColor: "#ff0000" });
    setAnnotationToolState("tool-c2", { activeTool: "blur", activeColor: "#00ff00" });
    clearAnnotationToolState("tool-c1");
    expect(getAnnotationToolState("tool-c1")).toBeUndefined();
    expect(getAnnotationToolState("tool-c2")).toBeDefined();
  });
});
