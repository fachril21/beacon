import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { organizationsStore } from "@/lib/supabase/stores";
import { PublicOrgHeaderContext } from "./public-org-header-context";

vi.mock("./use-session", () => ({
  useSession: () => ({ user: null }),
}));

const mockUseParams = vi.fn<() => Record<string, string | string[] | undefined>>(() => ({}));
vi.mock("next/navigation", () => ({
  useParams: () => mockUseParams(),
}));

const dibimbing = {
  id: "org-dibimbing",
  name: "Dibimbing",
  slug: "dibimbing",
  domain: "docs.dibimbing.id",
  isDomainVerified: true,
  pendingDnsToken: null,
  createdAt: "2026-01-01T00:00:00Z",
};
const cakrawala = {
  id: "org-cakrawala",
  name: "Cakrawala University",
  slug: "cakrawala-university",
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
    mockUseParams.mockReturnValue({});
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

  it("resolves the Organization from the URL's orgSlug param on a platform-domain route (/public/[orgSlug])", () => {
    mockUseParams.mockReturnValue({ orgSlug: "cakrawala-university" });

    const { result } = renderHook(() => usePublicOrgContext(), { wrapper: withHeader(null) });

    expect(result.current.organization).toEqual(cakrawala);
  });

  it("never reveals that other Organizations exist once a slug-resolved Organization is active", () => {
    mockUseParams.mockReturnValue({ orgSlug: "cakrawala-university" });

    const { result } = renderHook(() => usePublicOrgContext(), { wrapper: withHeader(null) });

    expect(result.current.organizations).toEqual([cakrawala]);
  });

  it("prefers the Host header over an orgSlug param if somehow both are present", () => {
    mockUseParams.mockReturnValue({ orgSlug: "cakrawala-university" });

    const { result } = renderHook(() => usePublicOrgContext(), { wrapper: withHeader("org-dibimbing") });

    expect(result.current.organization).toEqual(dibimbing);
  });

  it("returns null, not a fallback Organization, when orgSlug matches no known Organization", () => {
    mockUseParams.mockReturnValue({ orgSlug: "does-not-exist" });

    const { result } = renderHook(() => usePublicOrgContext(), { wrapper: withHeader(null) });

    expect(result.current.organization).toBeNull();
    expect(result.current.organizations).toEqual([]);
  });

  it("basePath is /public/{orgSlug} on a platform-domain route", () => {
    mockUseParams.mockReturnValue({ orgSlug: "cakrawala-university" });

    const { result } = renderHook(() => usePublicOrgContext(), { wrapper: withHeader(null) });

    expect(result.current.basePath).toBe("/public/cakrawala-university");
  });

  it("basePath is /public on a header-resolved custom domain route", () => {
    const { result } = renderHook(() => usePublicOrgContext(), { wrapper: withHeader("org-dibimbing") });

    expect(result.current.basePath).toBe("/public");
  });

  it("basePath is /public on the dev-switcher fallback (no header, no orgSlug)", () => {
    const { result } = renderHook(() => usePublicOrgContext(), { wrapper: withHeader(null) });

    expect(result.current.basePath).toBe("/public");
  });
});
