import { describe, it, expect } from "vitest";
import { buildPublicPageUrl } from "./public-url";

describe("buildPublicPageUrl", () => {
  it("returns the platform-domain path when no origin is given", () => {
    expect(buildPublicPageUrl("test-org", "getting-started")).toBe("/public/test-org/pages/getting-started");
  });

  it("returns an absolute URL when an origin is given", () => {
    expect(buildPublicPageUrl("test-org", "getting-started", "https://beacon.example.com")).toBe(
      "https://beacon.example.com/public/test-org/pages/getting-started",
    );
  });

  it("drops a trailing slash on the origin", () => {
    expect(buildPublicPageUrl("test-org", "a", "https://beacon.example.com/")).toBe(
      "https://beacon.example.com/public/test-org/pages/a",
    );
  });

  it("returns null when the organization slug is missing", () => {
    expect(buildPublicPageUrl(undefined, "a")).toBeNull();
    expect(buildPublicPageUrl("", "a")).toBeNull();
  });

  it("returns null when the page slug is missing, never a private-route fallback", () => {
    expect(buildPublicPageUrl("test-org", null)).toBeNull();
    expect(buildPublicPageUrl("test-org", undefined)).toBeNull();
  });
});
