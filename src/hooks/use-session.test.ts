import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const authStateCallbacks: Array<(event: string, session: unknown) => void> = [];

const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
      authStateCallbacks.push(cb);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => mockSupabase,
}));

function mockProfileFetch(profileRow: Record<string, unknown> | null) {
  mockSupabase.from.mockReturnValue({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: profileRow, error: profileRow ? null : new Error("not found") }),
      }),
    }),
  });
}

// Re-import after mocks are set up.
const { useSession, InvalidCredentialsError, EmailAlreadyRegisteredError } = await import("./use-session");

describe("useSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallbacks.length = 0;
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  });

  it("starts signed out when there is no Supabase session", async () => {
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("loads the profile row and exposes it as `user` once a session exists", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
    mockProfileFetch({
      id: "user-1",
      email: "a@example.com",
      name: "Ada",
      avatar_url: null,
      organization_id: "org-1",
      organization_role: "member",
      created_at: "2026-01-01T00:00:00Z",
    });

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual({
      id: "user-1",
      email: "a@example.com",
      name: "Ada",
      avatarUrl: null,
      organizationId: "org-1",
      organizationRole: "member",
      createdAt: "2026-01-01T00:00:00Z",
    });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("maps Supabase's 'Invalid login credentials' error to InvalidCredentialsError", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.signIn("a@example.com", "wrong")).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("maps Supabase's 'already registered' signUp error to EmailAlreadyRegisteredError", async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: null },
      error: { message: "User already registered" },
    });
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.signUp({ name: "Ada", email: "a@example.com", password: "password123" }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it("maps Supabase's anti-enumeration fake-success (empty identities) to EmailAlreadyRegisteredError", async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: { id: "user-1", identities: [] } },
      error: null,
    });
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      result.current.signUp({ name: "Ada", email: "a@example.com", password: "password123" }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it("calls supabase.auth.signOut on signOut", async () => {
    mockSupabase.auth.signOut.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });
    expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});
