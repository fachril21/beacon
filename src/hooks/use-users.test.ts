import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usersStore } from "@/lib/supabase/stores";

const mockSupabase = { from: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => mockSupabase }));

const { useUsers } = await import("./use-users");

describe("useUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usersStore.setState([]);
    usersStore.invalidate("all");
  });

  it("loads profiles from Supabase and maps them to the User shape", async () => {
    mockSupabase.from.mockReturnValue({
      select: () =>
        Promise.resolve({
          data: [
            {
              id: "user-1",
              email: "a@example.com",
              name: "Ada",
              avatar_url: null,
              organization_id: "org-1",
              organization_role: "member",
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
          error: null,
        }),
    });

    const { result } = renderHook(() => useUsers());
    await waitFor(() =>
      expect(result.current).toEqual([
        expect.objectContaining({ id: "user-1", name: "Ada", organizationId: "org-1" }),
      ]),
    );
  });

  it("scopes to a given organizationId when provided", async () => {
    mockSupabase.from.mockReturnValue({
      select: () =>
        Promise.resolve({
          data: [
            { id: "user-1", email: "a@example.com", name: "Ada", avatar_url: null, organization_id: "org-1", organization_role: "member", created_at: "t" },
            { id: "user-2", email: "b@example.com", name: "Budi", avatar_url: null, organization_id: "org-2", organization_role: "member", created_at: "t" },
          ],
          error: null,
        }),
    });

    const { result } = renderHook(() => useUsers("org-1"));
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].id).toBe("user-1");
  });
});
