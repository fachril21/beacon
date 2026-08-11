import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { savePendingEdit, loadPendingEdit, clearPendingEdit } from "./offline-buffer";
import { emptyDoc, doc, paragraph } from "@/lib/mock/blocknote-content";

describe("offline-buffer", () => {
  beforeEach(async () => {
    // Each test gets a clean slate for the pages it touches.
    await clearPendingEdit("page-1");
    await clearPendingEdit("page-2");
  });

  it("returns null when no pending edit exists for a Page", async () => {
    expect(await loadPendingEdit("page-1")).toBeNull();
  });

  it("round-trips a saved edit", async () => {
    const content = emptyDoc();
    await savePendingEdit("page-1", content);
    expect(await loadPendingEdit("page-1")).toEqual(content);
  });

  it("keeps edits for different Pages independent", async () => {
    await savePendingEdit("page-1", emptyDoc());
    expect(await loadPendingEdit("page-2")).toBeNull();
  });

  it("overwrites a prior pending edit for the same Page with the latest one", async () => {
    await savePendingEdit("page-1", emptyDoc());
    const second = doc([paragraph("changed")]);
    await savePendingEdit("page-1", second);
    expect(await loadPendingEdit("page-1")).toEqual(second);
  });

  it("clears a pending edit", async () => {
    await savePendingEdit("page-1", emptyDoc());
    await clearPendingEdit("page-1");
    expect(await loadPendingEdit("page-1")).toBeNull();
  });
});
