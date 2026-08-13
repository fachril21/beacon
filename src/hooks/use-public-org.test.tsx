import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { organizationsStore } from "@/lib/supabase/stores";
import { PublicOrgHeaderContext } from "./public-org-header-context";

vi.mock("./use-session", () => ({
  useSession: () => ({ user: null }),
}));

const dibimbing = {
  id: "org-dibimbing",
  name: "Dibimbing",
  domain: "docs.dibimbing.id",
  isDomainVerified: true,
  pendingDnsToken: null,
  createdAt: "2026-01-01T00:00:00Z",
};
const cakrawala = {
  id: "org-cakrawala",
  name: "Cakrawala University",
  domain: null,
  isDomainVerified: false,
  pendingDnsToken: null,
  createdAt: "2026-01-02T00:00:00Z",
};

const { usePublicOrgContext } = await import("./use-public-org");

function withHeader(headerOrgId: string | null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <PublicOrgHeaderContext.Provider value={headerOrgId}>{children}</PublicOrgHeaderContext.Provider>;
  };
}

describe("usePublicOrgContext", () => {
  beforeEach(() => {
    organizationsStore.setState([dibimbing, cakrawala]);
    window.localStorage.clear();
  });

  it("resolves the Organization from the real Host header when present (proxy.ts-resolved custom domain)", () => {
    const { result } = renderHook(() => usePublicOrgContext(), { wrapper: withHeader("org-dibimbing") });

    expect(result.current.organization).toEqual(dibimbing);
  });

  it("never reveals that other Organizations exist once a header-resolved Organization is active (PRD.md Flow 5)", () => {
    const { result } = renderHook(() => usePublicOrgContext(), { wrapper: withHeader("org-dibimbing") });

    expect(result.current.organizations).toEqual([dibimbing]);
  });

  it("ignores a dev-switcher localStorage selection once a header id is present", () => {
    window.localStorage.setItem("beacon.devPublicOrgId", "org-cakrawala");

    const { result } = renderHook(() => usePublicOrgContext(), { wrapper: withHeader("org-dibimbing") });

    expect(result.current.organization).toEqual(dibimbing);
  });

  it("falls back to the dev-switcher localStorage selection when no header is present (local/app-host access)", () => {
    window.localStorage.setItem("beacon.devPublicOrgId", "org-cakrawala");

    const { result } = renderHook(() => usePublicOrgContext(), { wrapper: withHeader(null) });

    expect(result.current.organization).toEqual(cakrawala);
    expect(result.current.organizations).toEqual([dibimbing, cakrawala]);
  });

  it("returns null, not a fallback Organization, when the header id matches no known Organization", () => {
    const { result } = renderHook(() => usePublicOrgContext(), { wrapper: withHeader("org-does-not-exist") });

    expect(result.current.organization).toBeNull();
    expect(result.current.organizations).toEqual([]);
  });
});
