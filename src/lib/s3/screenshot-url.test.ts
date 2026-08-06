import { describe, it, expect, afterEach } from "vitest";
import { resolveScreenshotUrl } from "./screenshot-url";

describe("resolveScreenshotUrl", () => {
  const original = process.env.NEXT_PUBLIC_S3_PUBLIC_URL_BASE;

  afterEach(() => {
    process.env.NEXT_PUBLIC_S3_PUBLIC_URL_BASE = original;
  });

  it("passes through values that are already a URL (Stage 1 mock fixtures, blob: previews)", () => {
    expect(resolveScreenshotUrl("blob:http://localhost/abc-123")).toBe("blob:http://localhost/abc-123");
    expect(resolveScreenshotUrl("https://cdn.example.com/shot.png")).toBe("https://cdn.example.com/shot.png");
    expect(resolveScreenshotUrl("/seed-screenshots/dashboard.png")).toBe("/seed-screenshots/dashboard.png");
  });

  it("prefixes a bare S3/MinIO object key with the configured public base URL", () => {
    process.env.NEXT_PUBLIC_S3_PUBLIC_URL_BASE = "http://localhost:9000/beacon-screenshots";
    expect(resolveScreenshotUrl("screenshots/page-1/abc.png")).toBe(
      "http://localhost:9000/beacon-screenshots/screenshots/page-1/abc.png",
    );
  });

  it("strips a trailing slash on the base URL to avoid a double slash", () => {
    process.env.NEXT_PUBLIC_S3_PUBLIC_URL_BASE = "http://localhost:9000/beacon-screenshots/";
    expect(resolveScreenshotUrl("screenshots/page-1/abc.png")).toBe(
      "http://localhost:9000/beacon-screenshots/screenshots/page-1/abc.png",
    );
  });
});
