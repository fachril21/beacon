import { describe, it, expect, vi, beforeEach } from "vitest";

const mockServerClient = {
  auth: { getUser: vi.fn() },
  rpc: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => Promise.resolve(mockServerClient),
}));

const mockAdminClient = {
  auth: {
    admin: { inviteUserByEmail: vi.fn() },
    resetPasswordForEmail: vi.fn(),
  },
};
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => mockAdminClient,
}));

const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/organizations/org-1/invite", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/organizations/[id]/invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServerClient.auth.getUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });
  });

  it("returns added immediately for an existing Account, without sending any email", async () => {
    mockServerClient.rpc.mockResolvedValue({
      data: { status: "added", membership: { id: "mem-1", organization_id: "org-1", user_id: "user-2", role: "member" } },
      error: null,
    });

    const response = await POST(makeRequest({ email: "existing@dibimbing.id", role: "member" }), {
      params: Promise.resolve({ id: "org-1" }),
    });
    const body = await response.json();

    expect(mockAdminClient.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
    expect(body).toEqual({ status: "added", membership: expect.objectContaining({ id: "mem-1" }) });
  });

  it("sends the invite email for a brand-new address with no Beacon Account, with the invite token in redirectTo", async () => {
    mockServerClient.rpc.mockResolvedValue({
      data: {
        status: "invited",
        invite: { id: "invite-1", organization_id: "org-1", email: "brand-new@dibimbing.id", role: "member", token: "tok-abc" },
      },
      error: null,
    });
    mockAdminClient.auth.admin.inviteUserByEmail.mockResolvedValue({ data: {}, error: null });

    const response = await POST(makeRequest({ email: "brand-new@dibimbing.id", role: "member" }), {
      params: Promise.resolve({ id: "org-1" }),
    });
    const body = await response.json();

    expect(mockAdminClient.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      "brand-new@dibimbing.id",
      expect.objectContaining({ redirectTo: expect.stringContaining("/accept-invite?token=tok-abc") }),
    );
    expect(body).toEqual({ status: "invited", invite: expect.objectContaining({ id: "invite-1" }), emailSent: true });
  });

  it("falls back to resetPasswordForEmail when the address already has an incomplete auth account", async () => {
    mockServerClient.rpc.mockResolvedValue({
      data: {
        status: "invited",
        invite: { id: "invite-2", organization_id: "org-1", email: "ghost@dibimbing.id", role: "member", token: "tok-def" },
      },
      error: null,
    });
    mockAdminClient.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: null,
      error: { message: "A user with this email address has already been registered" },
    });
    mockAdminClient.auth.resetPasswordForEmail.mockResolvedValue({ error: null });

    const response = await POST(makeRequest({ email: "ghost@dibimbing.id", role: "member" }), {
      params: Promise.resolve({ id: "org-1" }),
    });
    const body = await response.json();

    expect(mockAdminClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "ghost@dibimbing.id",
      expect.objectContaining({ redirectTo: expect.stringContaining("/accept-invite?token=tok-def") }),
    );
    expect(body).toEqual({ status: "invited", invite: expect.objectContaining({ id: "invite-2" }), emailSent: true });
  });

  it("maps NOT_AUTHORIZED to a 403", async () => {
    mockServerClient.rpc.mockResolvedValue({ data: null, error: { message: "NOT_AUTHORIZED: only an Organization owner or admin can invite members" } });

    const response = await POST(makeRequest({ email: "x@dibimbing.id", role: "member" }), {
      params: Promise.resolve({ id: "org-1" }),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "NOT_AUTHORIZED" });
  });

  it("returns 401 when there is no signed-in user", async () => {
    mockServerClient.auth.getUser.mockResolvedValue({ data: { user: null } });

    const response = await POST(makeRequest({ email: "x@dibimbing.id", role: "member" }), {
      params: Promise.resolve({ id: "org-1" }),
    });

    expect(response.status).toBe(401);
  });
});
