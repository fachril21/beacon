import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { organizationsStore, organizationMembershipsStore, organizationInvitationsStore } from "@/lib/supabase/stores";

const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => mockSupabase,
}));

vi.mock("./use-session", () => ({
  useSession: () => ({ user: { id: "user-1", organizationId: "org-1" } }),
}));

const {
  useOrganizations,
  useOrganizationDomainActions,
  useMyOrganizations,
  useOrganizationRole,
  useCreateOrganization,
  useOrganizationMembers,
  useOrganizationInvitations,
  useInviteToOrganization,
  useRevokeInvitation,
  useRemoveOrgMember,
  useTransferOwnership,
  useAcceptOrganizationInvite,
  useUpdateOrganizationName,
  useDeleteOrganization,
  useActiveOrganizationId,
  useSetActiveOrganization,
} = await import("./use-organizations");

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
              slug: "dibimbing",
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
          slug: "dibimbing",
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
        slug: "dibimbing",
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

  it("verifyDomain calls the verify-domain API route and patches the store when verified", async () => {
    organizationsStore.setState((prev) =>
      prev.map((o) => (o.id === "org-1" ? { ...o, domain: "docs.dibimbing.id", pendingDnsToken: "beacon-verify=abc" } : o)),
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ verified: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useOrganizationDomainActions("org-1"));
    let success = false;
    await act(async () => {
      success = await result.current.verifyDomain();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/organizations/org-1/verify-domain", { method: "POST" });
    expect(success).toBe(true);
    expect(organizationsStore.getState()[0]).toMatchObject({ isDomainVerified: true, pendingDnsToken: null });
    vi.unstubAllGlobals();
  });

  it("verifyDomain returns false without patching the store when DNS isn't propagated yet", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ verified: false, reason: "TXT record belum ditemukan." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useOrganizationDomainActions("org-1"));
    let success = true;
    await act(async () => {
      success = await result.current.verifyDomain();
    });

    expect(success).toBe(false);
    expect(organizationsStore.getState()[0].isDomainVerified).toBe(false);
    vi.unstubAllGlobals();
  });

  it("verifyDomain throws a friendly error when the API route rejects the request (e.g. rate limited)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Terlalu banyak percobaan verifikasi. Coba lagi dalam beberapa menit." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useOrganizationDomainActions("org-1"));
    await expect(result.current.verifyDomain()).rejects.toThrow("Terlalu banyak percobaan verifikasi");
    vi.unstubAllGlobals();
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

function resetOrgStores() {
  organizationsStore.setState([]);
  organizationsStore.invalidate("all");
  organizationMembershipsStore.setState([]);
  organizationMembershipsStore.invalidate("user:user-1");
  organizationMembershipsStore.invalidate("org:org-1");
  organizationInvitationsStore.setState([]);
  organizationInvitationsStore.invalidate("org:org-1");
}

describe("useMyOrganizations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrgStores();
  });

  it("returns only the Organizations the current user has a membership row in", async () => {
    organizationsStore.setState([
      { id: "org-1", name: "Org One", slug: "org-one", domain: null, isDomainVerified: false, pendingDnsToken: null, createdAt: "t" },
      { id: "org-2", name: "Org Two", slug: "org-two", domain: null, isDomainVerified: false, pendingDnsToken: null, createdAt: "t" },
    ]);
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "organization_memberships") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "mem-1", organization_id: "org-1", user_id: "user-1", role: "owner", created_at: "t" }], error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => useMyOrganizations());
    await waitFor(() => expect(result.current.map((o) => o.id)).toEqual(["org-1"]));
  });
});

describe("useOrganizationRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrgStores();
  });

  it("returns the current user's role for a given Organization, or null with no membership", async () => {
    organizationMembershipsStore.setState([{ id: "mem-1", organizationId: "org-1", userId: "user-1", role: "admin", createdAt: "t" }]);

    const { result: withRole } = renderHook(() => useOrganizationRole("org-1", "user-1"));
    expect(withRole.current).toBe("admin");

    const { result: withoutRole } = renderHook(() => useOrganizationRole("org-2", "user-1"));
    expect(withoutRole.current).toBeNull();
  });
});

describe("useCreateOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrgStores();
  });

  it("inserts the Organization row, then bootstraps the creator's own OWNER membership row", async () => {
    const orgRow = { id: "org-9", name: "New Co", slug: "new-co", domain: null, is_domain_verified: false, pending_dns_token: null, created_at: "t" };
    const membershipRow = { id: "mem-9", organization_id: "org-9", user_id: "user-1", role: "owner", created_at: "t" };

    const orgsInsert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: orgRow, error: null }) }) }));
    const membershipsInsert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: membershipRow, error: null }) }) }));
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "organizations") return { insert: orgsInsert };
      if (table === "organization_memberships") return { insert: membershipsInsert };
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => useCreateOrganization());
    let created: unknown;
    await act(async () => {
      created = await result.current({ name: "New Co", createdByUserId: "user-1" });
    });

    expect(orgsInsert).toHaveBeenCalledWith(expect.objectContaining({ name: "New Co" }));
    expect(membershipsInsert).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: "org-9", user_id: "user-1", role: "owner" }),
    );
    expect(created).toMatchObject({ id: "org-9", name: "New Co" });
    expect(organizationsStore.getState()).toEqual([expect.objectContaining({ id: "org-9" })]);
    expect(organizationMembershipsStore.getState()).toEqual([expect.objectContaining({ organizationId: "org-9", role: "owner" })]);
  });

  it("deletes the just-created Organization if the bootstrap membership insert fails, instead of leaving an inaccessible orphan", async () => {
    const orgRow = { id: "org-9", name: "New Co", slug: "new-co", domain: null, is_domain_verified: false, pending_dns_token: null, created_at: "t" };
    const membershipError = { message: "new row violates row-level security policy" };

    const orgsInsert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: orgRow, error: null }) }) }));
    const membershipsInsert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: membershipError }) }) }));
    const orgsDeleteEq = vi.fn(() => Promise.resolve({ error: null }));
    const orgsDelete = vi.fn(() => ({ eq: orgsDeleteEq }));

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "organizations") return { insert: orgsInsert, delete: orgsDelete };
      if (table === "organization_memberships") return { insert: membershipsInsert };
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => useCreateOrganization());
    await expect(
      act(async () => {
        await result.current({ name: "New Co", createdByUserId: "user-1" });
      }),
    ).rejects.toEqual(membershipError);

    expect(orgsDeleteEq).toHaveBeenCalledWith("id", "org-9");
    expect(organizationsStore.getState()).toEqual([]);
  });
});

describe("useOrganizationMembers / useOrganizationInvitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrgStores();
  });

  it("loads and maps organization_memberships for the given org", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "organization_memberships") {
        return { select: () => ({ eq: () => Promise.resolve({ data: [{ id: "mem-1", organization_id: "org-1", user_id: "user-2", role: "member", created_at: "t" }], error: null }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => useOrganizationMembers("org-1"));
    await waitFor(() => expect(result.current).toEqual([expect.objectContaining({ userId: "user-2", role: "member" })]));
  });

  it("loads and maps organization_invitations for the given org", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "organization_invitations") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [
                  {
                    id: "invite-1",
                    organization_id: "org-1",
                    email: "new@example.com",
                    role: "member",
                    token: "tok",
                    invited_by_user_id: "user-1",
                    status: "pending",
                    expires_at: "t2",
                    accepted_at: null,
                    created_at: "t",
                  },
                ],
                error: null,
              }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => useOrganizationInvitations("org-1"));
    await waitFor(() => expect(result.current).toEqual([expect.objectContaining({ email: "new@example.com", status: "pending" })]));
  });
});

describe("useInviteToOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrgStores();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("posts to /api/organizations/{id}/invite and patches organizationInvitationsStore on status=invited", async () => {
    const inviteRow = { id: "invite-1", organization_id: "org-1", email: "new@example.com", role: "member", token: "tok", invited_by_user_id: "user-1", status: "pending", expires_at: "t2", accepted_at: null, created_at: "t" };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: "invited", invite: inviteRow, emailSent: true }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useInviteToOrganization());
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current("org-1", "new@example.com", "member");
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/organizations/org-1/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new@example.com", role: "member" }),
    });
    expect(outcome).toEqual({ status: "invited", emailSent: true });
    expect(organizationInvitationsStore.getState()).toEqual([expect.objectContaining({ id: "invite-1" })]);
  });

  it("throws a friendly error when the route rejects the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: "NOT_AUTHORIZED" }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useInviteToOrganization());
    await expect(result.current("org-1", "x@example.com", "member")).rejects.toThrow("NOT_AUTHORIZED");
  });
});

describe("useRevokeInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrgStores();
  });

  it("updates status to revoked and patches the store", async () => {
    organizationInvitationsStore.setState([
      { id: "invite-1", organizationId: "org-1", email: "a@example.com", role: "member", token: "t1", invitedByUserId: "user-1", status: "pending", expiresAt: "t2", acceptedAt: null, createdAt: "t" },
    ]);
    const eqMock = vi.fn(() => Promise.resolve({ error: null }));
    mockSupabase.from.mockReturnValue({ update: () => ({ eq: eqMock }) });

    const { result } = renderHook(() => useRevokeInvitation());
    await act(async () => {
      await result.current("invite-1");
    });

    expect(eqMock).toHaveBeenCalledWith("id", "invite-1");
    expect(organizationInvitationsStore.getState()[0].status).toBe("revoked");
  });
});

describe("useRemoveOrgMember / useTransferOwnership / useAcceptOrganizationInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrgStores();
  });

  it("useRemoveOrgMember calls remove_organization_member and drops the row from the store on success", async () => {
    organizationMembershipsStore.setState([{ id: "mem-1", organizationId: "org-1", userId: "user-2", role: "member", createdAt: "t" }]);
    mockSupabase.rpc.mockResolvedValue({ data: { status: "removed" }, error: null });

    const { result } = renderHook(() => useRemoveOrgMember());
    await act(async () => {
      await result.current("org-1", "user-2");
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith("remove_organization_member", { p_organization_id: "org-1", p_user_id: "user-2" });
    expect(organizationMembershipsStore.getState()).toEqual([]);
  });

  it("useRemoveOrgMember surfaces CANNOT_REMOVE_OWNER without touching the store", async () => {
    organizationMembershipsStore.setState([{ id: "mem-1", organizationId: "org-1", userId: "user-2", role: "owner", createdAt: "t" }]);
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "CANNOT_REMOVE_OWNER: transfer ownership before removing the current owner" } });

    const { result } = renderHook(() => useRemoveOrgMember());
    await expect(result.current("org-1", "user-2")).rejects.toThrow("CANNOT_REMOVE_OWNER");
    expect(organizationMembershipsStore.getState()).toHaveLength(1);
  });

  it("useTransferOwnership calls transfer_organization_ownership and flips both roles in the store", async () => {
    organizationMembershipsStore.setState([
      { id: "mem-1", organizationId: "org-1", userId: "user-1", role: "owner", createdAt: "t" },
      { id: "mem-2", organizationId: "org-1", userId: "user-2", role: "member", createdAt: "t" },
    ]);
    mockSupabase.rpc.mockResolvedValue({ data: { status: "transferred", newOwnerId: "user-2" }, error: null });

    const { result } = renderHook(() => useTransferOwnership());
    await act(async () => {
      await result.current("org-1", "user-2");
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith("transfer_organization_ownership", { p_organization_id: "org-1", p_new_owner_user_id: "user-2" });
    const roles = Object.fromEntries(organizationMembershipsStore.getState().map((m) => [m.userId, m.role]));
    expect(roles).toEqual({ "user-1": "admin", "user-2": "owner" });
  });

  it("useAcceptOrganizationInvite calls accept_organization_invite with the token", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { status: "accepted", membership: { id: "mem-1", organization_id: "org-1", user_id: "user-1", role: "member", created_at: "t" } }, error: null });

    const { result } = renderHook(() => useAcceptOrganizationInvite());
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current("some-token");
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith("accept_organization_invite", { p_token: "some-token" });
    expect(outcome).toMatchObject({ status: "accepted" });
  });
});

describe("useUpdateOrganizationName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrgStores();
  });

  it("updates the row and patches the store on success", async () => {
    organizationsStore.setState([
      { id: "org-1", name: "Old Name", slug: "old-name", domain: null, isDomainVerified: false, pendingDnsToken: null, createdAt: "t" },
    ]);
    const eqMock = vi.fn(() => Promise.resolve({ error: null }));
    mockSupabase.from.mockReturnValue({ update: () => ({ eq: eqMock }) });

    const { result } = renderHook(() => useUpdateOrganizationName());
    await act(async () => {
      await result.current("org-1", "New Name");
    });

    expect(eqMock).toHaveBeenCalledWith("id", "org-1");
    expect(organizationsStore.getState()[0].name).toBe("New Name");
  });

  it("throws without touching the store when Supabase returns an error", async () => {
    organizationsStore.setState([
      { id: "org-1", name: "Old Name", slug: "old-name", domain: null, isDomainVerified: false, pendingDnsToken: null, createdAt: "t" },
    ]);
    mockSupabase.from.mockReturnValue({ update: () => ({ eq: () => Promise.resolve({ error: { message: "permission denied" } }) }) });

    const { result } = renderHook(() => useUpdateOrganizationName());
    await expect(result.current("org-1", "New Name")).rejects.toEqual({ message: "permission denied" });
    expect(organizationsStore.getState()[0].name).toBe("Old Name");
  });
});

describe("useDeleteOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrgStores();
  });

  it("deletes the row and drops every cascaded row from local stores", async () => {
    organizationsStore.setState([
      { id: "org-1", name: "Org", slug: "org", domain: null, isDomainVerified: false, pendingDnsToken: null, createdAt: "t" },
    ]);
    organizationMembershipsStore.setState([{ id: "mem-1", organizationId: "org-1", userId: "user-1", role: "owner", createdAt: "t" }]);
    organizationInvitationsStore.setState([
      { id: "invite-1", organizationId: "org-1", email: "a@example.com", role: "member", token: "t1", invitedByUserId: "user-1", status: "pending", expiresAt: "t2", acceptedAt: null, createdAt: "t" },
    ]);

    const eqMock = vi.fn(() => Promise.resolve({ error: null }));
    mockSupabase.from.mockReturnValue({ delete: () => ({ eq: eqMock }) });

    const { result } = renderHook(() => useDeleteOrganization());
    await act(async () => {
      await result.current("org-1");
    });

    expect(eqMock).toHaveBeenCalledWith("id", "org-1");
    expect(organizationsStore.getState()).toEqual([]);
    expect(organizationMembershipsStore.getState()).toEqual([]);
    expect(organizationInvitationsStore.getState()).toEqual([]);
  });

  it("throws without touching the store when Supabase returns an error", async () => {
    organizationsStore.setState([
      { id: "org-1", name: "Org", slug: "org", domain: null, isDomainVerified: false, pendingDnsToken: null, createdAt: "t" },
    ]);
    mockSupabase.from.mockReturnValue({ delete: () => ({ eq: () => Promise.resolve({ error: { message: "permission denied" } }) }) });

    const { result } = renderHook(() => useDeleteOrganization());
    await expect(result.current("org-1")).rejects.toEqual({ message: "permission denied" });
    expect(organizationsStore.getState()).toEqual([expect.objectContaining({ id: "org-1" })]);
  });
});

describe("useActiveOrganizationId / useSetActiveOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOrgStores();
    localStorage.clear();
  });

  it("returns null when nothing has been set for this user", () => {
    const { result } = renderHook(() => useActiveOrganizationId("user-1"));
    expect(result.current).toBeNull();
  });

  it("useSetActiveOrganization persists per-user and useActiveOrganizationId reads it back", () => {
    const { result: setter } = renderHook(() => useSetActiveOrganization());
    act(() => {
      setter.current("user-1", "org-2");
    });

    const { result: getterForUser1 } = renderHook(() => useActiveOrganizationId("user-1"));
    expect(getterForUser1.current).toBe("org-2");

    // Scoped per user — a different user id on the same browser sees nothing.
    const { result: getterForUser2 } = renderHook(() => useActiveOrganizationId("user-2"));
    expect(getterForUser2.current).toBeNull();
  });
});
