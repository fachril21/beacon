import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { organizationsStore } from "@/lib/supabase/stores";

const mockSupabase = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => mockSupabase,
}));

vi.mock("./use-session", () => ({
  useSession: () => ({ user: { id: "user-1", organizationId: "org-1" } }),
}));

const { useOrganizations, useOrganizationDomainActions } = await import("./use-organizations");

function resetStore() {
  organizationsStore.setState([]);
  // Force every scope key to be re-fetchable between tests.
  organizationsStore.invalidate("all");
}

describe("useOrganizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("loads organizations from Supabase and maps them to camelCase", async () => {
    mockSupabase.from.mockReturnValue({
      select: () =>
        Promise.resolve({
          data: [
            {
              id: "org-1",
              name: "Dibimbing",
              domain: null,
              is_domain_verified: false,
              pending_dns_token: null,
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
          error: null,
        }),
    });

    const { result } = renderHook(() => useOrganizations());
    await waitFor(() =>
      expect(result.current).toEqual([
        {
          id: "org-1",
          name: "Dibimbing",
          domain: null,
          isDomainVerified: false,
          pendingDnsToken: null,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]),
    );
  });
});

describe("useOrganizationDomainActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    organizationsStore.setState([
      {
        id: "org-1",
        name: "Dibimbing",
        domain: null,
        isDomainVerified: false,
        pendingDnsToken: null,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("addDomain updates the row and patches the store on success", async () => {
    const update = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    mockSupabase.from.mockReturnValue({ update });

    const { result } = renderHook(() => useOrganizationDomainActions("org-1"));
    await act(async () => {
      await result.current.addDomain("docs.dibimbing.id");
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "docs.dibimbing.id", is_domain_verified: false }),
    );
    expect(organizationsStore.getState()[0].domain).toBe("docs.dibimbing.id");
  });

  it("addDomain surfaces a duplicate-domain Postgres unique violation (23505) as a friendly error", async () => {
    mockSupabase.from.mockReturnValue({
      update: () => ({ eq: () => Promise.resolve({ error: { code: "23505" } }) }),
    });

    const { result } = renderHook(() => useOrganizationDomainActions("org-1"));
    await expect(result.current.addDomain("docs.cakrawala.ac.id")).rejects.toThrow(
      "Domain ini sudah digunakan oleh Organisasi lain.",
    );
  });

  it("removeDomain clears domain fields and patches the store", async () => {
    mockSupabase.from.mockReturnValue({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    });
    organizationsStore.setState((prev) =>
      prev.map((o) => (o.id === "org-1" ? { ...o, domain: "docs.dibimbing.id", isDomainVerified: true } : o)),
    );

    const { result } = renderHook(() => useOrganizationDomainActions("org-1"));
    await act(async () => {
      await result.current.removeDomain();
    });

    expect(organizationsStore.getState()[0]).toMatchObject({
      domain: null,
      isDomainVerified: false,
      pendingDnsToken: null,
    });
  });
});
