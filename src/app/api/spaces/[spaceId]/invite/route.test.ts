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
  from: vi.fn(),
};
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => mockAdminClient,
}));

const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/spaces/space-1/invite", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function mockNoExistingProfile() {
  mockAdminClient.from.mockImplementation((table: string) => {
    if (table === "profiles") {
      return { select: () => ({ ilike: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) };
    }
    throw new Error(`unexpected table ${table}`);
  });
}

describe("POST /api/spaces/[spaceId]/invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServerClient.auth.getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
  });

  it("sends the invite email for a brand-new address with no Beacon Account", async () => {
    mockServerClient.rpc.mockResolvedValue({
      data: {
        status: "invited",
        invite: { id: "invite-1", space_id: "space-1", email: "brand-new@dibimbing.id", role: "viewer" },
      },
      error: null,
    });
    mockAdminClient.auth.admin.inviteUserByEmail.mockResolvedValue({ data: {}, error: null });
    mockNoExistingProfile();

    const response = await POST(makeRequest({ email: "brand-new@dibimbing.id", role: "viewer" }), {
      params: Promise.resolve({ spaceId: "space-1" }),
    });
    const body = await response.json();

    expect(mockAdminClient.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      "brand-new@dibimbing.id",
      expect.objectContaining({ redirectTo: expect.stringContaining("/complete-invite") }),
    );
    expect(body).toEqual({
      status: "invited",
      invite: expect.objectContaining({ id: "invite-1" }),
      emailSent: true,
    });
  });

  it("still delivers an email when the address already has an incomplete auth account but no Beacon Account (profile) yet", async () => {
    mockServerClient.rpc.mockResolvedValue({
      data: {
        status: "invited",
        invite: { id: "invite-2", space_id: "space-1", email: "ghost@dibimbing.id", role: "viewer" },
      },
      error: null,
    });
    // inviteUserByEmail rejects because auth.users already has a row for this
    // email (e.g. a prior invite that was never completed) — but no
    // `profiles` row exists, so this person still has no Beacon Account.
    mockAdminClient.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: null,
      error: { message: "A user with this email address has already been registered" },
    });
    mockAdminClient.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    mockNoExistingProfile();

    const response = await POST(makeRequest({ email: "ghost@dibimbing.id", role: "viewer" }), {
      params: Promise.resolve({ spaceId: "space-1" }),
    });
    const body = await response.json();

    expect(mockAdminClient.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "ghost@dibimbing.id",
      expect.objectContaining({ redirectTo: expect.stringContaining("/complete-invite") }),
    );
    expect(body).toEqual({
      status: "invited",
      invite: expect.objectContaining({ id: "invite-2" }),
      emailSent: true,
    });
  });

  it("reports emailSent: false only when both the invite email and the fallback resend genuinely fail", async () => {
    mockServerClient.rpc.mockResolvedValue({
      data: {
        status: "invited",
        invite: { id: "invite-3", space_id: "space-1", email: "unreachable@dibimbing.id", role: "viewer" },
      },
      error: null,
    });
    mockAdminClient.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: null,
      error: { message: "A user with this email address has already been registered" },
    });
    mockAdminClient.auth.resetPasswordForEmail.mockResolvedValue({ error: { message: "SMTP error" } });
    mockNoExistingProfile();

    const response = await POST(makeRequest({ email: "unreachable@dibimbing.id", role: "viewer" }), {
      params: Promise.resolve({ spaceId: "space-1" }),
    });
    const body = await response.json();

    expect(body).toEqual({
      status: "invited",
      invite: expect.objectContaining({ id: "invite-3" }),
      emailSent: false,
    });
  });
});
