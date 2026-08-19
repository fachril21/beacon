import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { getActiveAnnotationTool, setActiveAnnotationTool, useActiveAnnotationTool } from "./annotation-tool-store";

describe("annotation tool store", () => {
  it("returns null for a block that never had a tool set", () => {
    expect(getActiveAnnotationTool("block-never-touched")).toBeNull();
  });

  it("returns the tool that was set for a block", () => {
    setActiveAnnotationTool("block-1", "box");
    expect(getActiveAnnotationTool("block-1")).toBe("box");
  });

  it("overwrites a previous tool for the same block, not merges", () => {
    setActiveAnnotationTool("block-2", "box");
    setActiveAnnotationTool("block-2", "arrow");
    expect(getActiveAnnotationTool("block-2")).toBe("arrow");
  });

  it("keeps tool selection for different blocks independent", () => {
    setActiveAnnotationTool("block-3", "marker");
    setActiveAnnotationTool("block-4", "label");
    expect(getActiveAnnotationTool("block-3")).toBe("marker");
    expect(getActiveAnnotationTool("block-4")).toBe("label");
  });

  it("clears a block's tool by setting it to null, leaving other blocks intact", () => {
    setActiveAnnotationTool("block-5", "box");
    setActiveAnnotationTool("block-6", "arrow");
    setActiveAnnotationTool("block-5", null);
    expect(getActiveAnnotationTool("block-5")).toBeNull();
    expect(getActiveAnnotationTool("block-6")).toBe("arrow");
  });
});

describe("useActiveAnnotationTool", () => {
  it("reads the current tool for a block and stays in sync with external updates", () => {
    setActiveAnnotationTool("block-hook-1", null);
    const { result } = renderHook(() => useActiveAnnotationTool("block-hook-1"));
    expect(result.current[0]).toBeNull();

    act(() => {
      setActiveAnnotationTool("block-hook-1", "marker");
    });
    expect(result.current[0]).toBe("marker");
  });

  it("exposes a setter that updates only the block it was called for", () => {
    setActiveAnnotationTool("block-hook-2", null);
    setActiveAnnotationTool("block-hook-3", null);
    const { result: a } = renderHook(() => useActiveAnnotationTool("block-hook-2"));
    const { result: b } = renderHook(() => useActiveAnnotationTool("block-hook-3"));

    act(() => {
      a.current[1]("box");
    });

    expect(a.current[0]).toBe("box");
    expect(b.current[0]).toBeNull();
  });
});
