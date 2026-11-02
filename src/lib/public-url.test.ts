import { describe, it, expect } from "vitest";
import { buildPublicPageUrl, buildPublicSpaceUrl, publicPageHref, publicSpaceHref } from "./public-url";

describe("buildPublicSpaceUrl", () => {
  it("returns the platform-domain Space path when no origin is given", () => {
    expect(buildPublicSpaceUrl("test-org", "lms-b2b-admin")).toBe("/public/test-org/spaces/lms-b2b-admin");
  });

  it("returns an absolute URL when an origin is given", () => {
    expect(buildPublicSpaceUrl("test-org", "lms-b2b-admin", "https://beacon.example.com")).toBe(
      "https://beacon.example.com/public/test-org/spaces/lms-b2b-admin",
    );
  });

  it("drops a trailing slash on the origin", () => {
    expect(buildPublicSpaceUrl("test-org", "a", "https://beacon.example.com/")).toBe(
      "https://beacon.example.com/public/test-org/spaces/a",
    );
  });

  it("returns null when either slug is missing", () => {
    expect(buildPublicSpaceUrl(undefined, "a")).toBeNull();
    expect(buildPublicSpaceUrl("", "a")).toBeNull();
    expect(buildPublicSpaceUrl("test-org", null)).toBeNull();
    expect(buildPublicSpaceUrl("test-org", undefined)).toBeNull();
  });
});

describe("buildPublicPageUrl", () => {
  it("nests the Page under its own Space", () => {
    expect(buildPublicPageUrl("test-org", "lms-b2b-admin", "getting-started")).toBe(
      "/public/test-org/spaces/lms-b2b-admin/pages/getting-started",
    );
  });

  it("returns an absolute URL when an origin is given", () => {
    expect(buildPublicPageUrl("test-org", "lms-b2b-admin", "getting-started", "https://beacon.example.com")).toBe(
      "https://beacon.example.com/public/test-org/spaces/lms-b2b-admin/pages/getting-started",
    );
  });

  it("drops a trailing slash on the origin", () => {
    expect(buildPublicPageUrl("test-org", "a", "b", "https://beacon.example.com/")).toBe(
      "https://beacon.example.com/public/test-org/spaces/a/pages/b",
    );
  });

  it("returns null when any slug is missing, never a private-route fallback", () => {
    expect(buildPublicPageUrl(undefined, "a", "b")).toBeNull();
    expect(buildPublicPageUrl("", "a", "b")).toBeNull();
    expect(buildPublicPageUrl("test-org", null, "b")).toBeNull();
    expect(buildPublicPageUrl("test-org", "a", null)).toBeNull();
    expect(buildPublicPageUrl("test-org", "a", undefined)).toBeNull();
  });
});

describe("publicPageHref / publicSpaceHref", () => {
  it("builds Space-scoped paths from the context basePath", () => {
    expect(publicPageHref("/public/dibimbing", "lms-b2b-admin", "login")).toBe(
      "/public/dibimbing/spaces/lms-b2b-admin/pages/login",
    );
    expect(publicSpaceHref("/public/dibimbing", "lms-b2b-admin")).toBe("/public/dibimbing/spaces/lms-b2b-admin");
  });

  it("supports the custom-domain basePath (/public) without an Organization segment", () => {
    expect(publicPageHref("/public", "lms-b2b-admin", "login")).toBe("/public/spaces/lms-b2b-admin/pages/login");
    expect(publicSpaceHref("/public", "lms-b2b-admin")).toBe("/public/spaces/lms-b2b-admin");
  });

  it("returns null when a slug is missing", () => {
    expect(publicPageHref("/public/org", null, "login")).toBeNull();
    expect(publicPageHref("/public/org", "space", null)).toBeNull();
    expect(publicSpaceHref("/public/org", undefined)).toBeNull();
  });
});
