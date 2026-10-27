import { describe, it, expect } from "vitest";
import { UNTITLED_PAGE_LABEL, titleOrUntitled } from "./page-label";

describe("UNTITLED_PAGE_LABEL", () => {
  it("is the exact placeholder the editor's title field promises", () => {
    expect(UNTITLED_PAGE_LABEL).toBe("Untitled page");
  });
});

describe("titleOrUntitled", () => {
  it("returns the title when there is one", () => {
    expect(titleOrUntitled("Cara login")).toBe("Cara login");
  });

  it("falls back to the label for empty, whitespace-only, and missing titles", () => {
    expect(titleOrUntitled("")).toBe("Untitled page");
    expect(titleOrUntitled("   ")).toBe("Untitled page");
    expect(titleOrUntitled(null)).toBe("Untitled page");
    expect(titleOrUntitled(undefined)).toBe("Untitled page");
  });
});
