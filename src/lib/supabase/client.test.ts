import { describe, it, expect, vi } from "vitest";

const mockCreateBrowserClient = vi.fn(() => ({}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: mockCreateBrowserClient,
}));

vi.mock("./env", () => ({
  getSupabaseUrl: () => "https://example.supabase.co",
  getSupabaseAnonKey: () => "anon-key",
  getSupabaseSchema: () => "beacon",
}));

const { getSupabaseBrowserClient } = await import("./client");

describe("getSupabaseBrowserClient", () => {
  it("configures the implicit auth flow, since Kerjain's origin has no access to a PKCE code_verifier stored in Beacon's localStorage when a recovery email redirects there", () => {
    getSupabaseBrowserClient();

    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.objectContaining({ auth: expect.objectContaining({ flowType: "implicit" }) }),
    );
  });

  it("consumes an invite/recovery email link's #access_token fragment via setSession, then strips the tokens from the URL", async () => {
    vi.resetModules();
    const fragmentClient = {
      auth: { setSession: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    };
    mockCreateBrowserClient.mockReturnValue(fragmentClient);
    window.location.hash = "#access_token=at-1&refresh_token=rt-1&expires_in=3600&token_type=bearer&type=invite";

    const { getSupabaseBrowserClient: fresh } = await import("./client");
    fresh();

    await vi.waitFor(() =>
      expect(fragmentClient.auth.setSession).toHaveBeenCalledWith({ access_token: "at-1", refresh_token: "rt-1" }),
    );
    await vi.waitFor(() => expect(window.location.hash).toBe(""));
  });

  it("leaves the URL alone when there is no auth fragment (normal navigation)", async () => {
    vi.resetModules();
    const plainClient = {
      auth: { setSession: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    };
    mockCreateBrowserClient.mockReturnValue(plainClient);
    window.location.hash = "";

    const { getSupabaseBrowserClient: fresh } = await import("./client");
    fresh();

    expect(plainClient.auth.setSession).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });
});
