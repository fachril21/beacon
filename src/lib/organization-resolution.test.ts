import { describe, it, expect } from "vitest";
import { normalizeHost, isAppHost, resolveOrganizationForHost } from "./organization-resolution";

describe("normalizeHost", () => {
  it("lowercases and strips a port number", () => {
    expect(normalizeHost("Docs.Dibimbing.ID:3000")).toBe("docs.dibimbing.id");
  });

  it("passes through a bare hostname unchanged (besides lowercasing)", () => {
    expect(normalizeHost("LOCALHOST")).toBe("localhost");
  });
});

describe("isAppHost", () => {
  const appHosts = ["localhost", "beacon.vercel.app"];

  it("matches the app's own configured hosts", () => {
    expect(isAppHost("localhost:3000", appHosts)).toBe(true);
    expect(isAppHost("beacon.vercel.app", appHosts)).toBe(true);
  });

  it("matches any Vercel preview deployment subdomain", () => {
    expect(isAppHost("beacon-git-feature-x-team.vercel.app", appHosts)).toBe(true);
  });

  it("does not match a real custom domain", () => {
    expect(isAppHost("docs.dibimbing.id", appHosts)).toBe(false);
  });
});

describe("resolveOrganizationForHost", () => {
  const dibimbing = { id: "org-1", name: "Dibimbing", domain: "docs.dibimbing.id", isDomainVerified: true, pendingDnsToken: null, createdAt: "t" };
  const cakrawala = { id: "org-2", name: "Cakrawala University", domain: "docs.cakrawala.ac.id", isDomainVerified: false, pendingDnsToken: "beacon-verify=abc", createdAt: "t" };

  it("resolves a verified custom domain to its Organization", () => {
    const result = resolveOrganizationForHost("docs.dibimbing.id", [dibimbing, cakrawala]);
    expect(result).toEqual(dibimbing);
  });

  it("is case-insensitive and ignores a port number", () => {
    const result = resolveOrganizationForHost("Docs.Dibimbing.ID:443", [dibimbing, cakrawala]);
    expect(result).toEqual(dibimbing);
  });

  it("returns null for an unverified domain — never a fallback to real content (PRD.md Epic 14a AC)", () => {
    const result = resolveOrganizationForHost("docs.cakrawala.ac.id", [dibimbing, cakrawala]);
    expect(result).toBeNull();
  });

  it("returns null for a host that matches no Organization at all", () => {
    const result = resolveOrganizationForHost("evil.example.com", [dibimbing, cakrawala]);
    expect(result).toBeNull();
  });

  it("never lets one Organization's domain resolve to a different Organization's row", () => {
    const result = resolveOrganizationForHost("docs.cakrawala.ac.id", [dibimbing]);
    expect(result).toBeNull();
  });
});
