import { describe, it, expect, vi } from "vitest";
import { verifyDomainOwnership } from "./verify-domain";

describe("verifyDomainOwnership", () => {
  it("verifies when a TXT record matches the expected token exactly", async () => {
    const resolveTxt = vi.fn().mockResolvedValue([["beacon-verify=abc123"], ["other-record"]]);

    const result = await verifyDomainOwnership("docs.dibimbing.id", "beacon-verify=abc123", resolveTxt);

    expect(result).toEqual({ verified: true, reason: null });
  });

  it("joins multi-chunk TXT records before comparing", async () => {
    const resolveTxt = vi.fn().mockResolvedValue([["beacon-verify=", "abc123"]]);

    const result = await verifyDomainOwnership("docs.dibimbing.id", "beacon-verify=abc123", resolveTxt);

    expect(result.verified).toBe(true);
  });

  it("fails when no TXT record matches the token", async () => {
    const resolveTxt = vi.fn().mockResolvedValue([["unrelated-record"]]);

    const result = await verifyDomainOwnership("docs.dibimbing.id", "beacon-verify=abc123", resolveTxt);

    expect(result.verified).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("fails gracefully when DNS resolution throws (NXDOMAIN, timeout, etc.)", async () => {
    const resolveTxt = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));

    const result = await verifyDomainOwnership("docs.dibimbing.id", "beacon-verify=abc123", resolveTxt);

    expect(result.verified).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});
