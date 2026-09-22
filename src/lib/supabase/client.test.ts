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
});
