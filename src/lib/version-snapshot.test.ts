import { describe, it, expect } from "vitest";
import { shouldSnapshot, isSameAsVersion, VERSION_SNAPSHOT_INTERVAL_MS } from "./version-snapshot";
import type { PageContent, Version } from "@/lib/types";

const NOW = Date.parse("2026-01-01T12:00:00.000Z");
const contentA = [{ id: "a", type: "paragraph", content: "A" }] as unknown as PageContent;
const contentB = [{ id: "a", type: "paragraph", content: "B" }] as unknown as PageContent;

function version(overrides: Partial<Version> = {}): Version {
  return {
    id: "v-1",
    pageId: "page-1",
    title: "Judul",
    content: contentA,
    createdByUserId: "user-1",
    createdAt: new Date(NOW - VERSION_SNAPSHOT_INTERVAL_MS - 1000).toISOString(),
    isRestoreOf: null,
    ...overrides,
  };
}

describe("isSameAsVersion", () => {
  it("is false when there is no version to compare with", () => {
    expect(isSameAsVersion(null, "Judul", contentA)).toBe(false);
  });

  it("ignores insignificant differences (trailing empty paragraph)", () => {
    const withTrailing = [...(contentA as unknown[]), { id: "t", type: "paragraph", content: [] }] as unknown as PageContent;
    expect(isSameAsVersion(version(), "Judul", withTrailing)).toBe(true);
  });

  it("is true only when both title and content are identical", () => {
    expect(isSameAsVersion(version(), "Judul", contentA)).toBe(true);
    expect(isSameAsVersion(version(), "Judul baru", contentA)).toBe(false);
    expect(isSameAsVersion(version(), "Judul", contentB)).toBe(false);
  });
});

describe("VERSION_SNAPSHOT_INTERVAL_MS", () => {
  it("is one minute", () => {
    expect(VERSION_SNAPSHOT_INTERVAL_MS).toBe(60_000);
  });
});

describe("shouldSnapshot", () => {
  it("snapshots a page that has no versions yet (baseline)", () => {
    expect(shouldSnapshot(null, "Judul", contentA, NOW)).toBe(true);
  });

  it("snapshots when the latest version is older than the interval and content changed", () => {
    expect(shouldSnapshot(version(), "Judul", contentB, NOW)).toBe(true);
  });

  it("skips when the latest version is newer than the interval", () => {
    const recent = version({ createdAt: new Date(NOW - 1000).toISOString() });
    expect(shouldSnapshot(recent, "Judul", contentB, NOW)).toBe(false);
  });

  it("skips when nothing changed since the latest version, however old it is", () => {
    expect(shouldSnapshot(version(), "Judul", contentA, NOW)).toBe(false);
  });
});
