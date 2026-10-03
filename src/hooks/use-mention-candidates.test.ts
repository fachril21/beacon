import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockSupabase = { rpc: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => mockSupabase }));

const users = [
  { id: "u1", name: "Fachril", email: "f@x.id", avatarUrl: null, organizationId: null, createdAt: "t" },
  { id: "u2", name: "Sari", email: "s@x.id", avatarUrl: null, organizationId: null, createdAt: "t" },
  { id: "u3", name: "Bukan Anggota", email: "b@x.id", avatarUrl: null, organizationId: null, createdAt: "t" },
];
vi.mock("@/hooks/use-users", () => ({ useUsers: () => users }));
vi.mock("@/hooks/use-pages", () => ({
  usePage: (id?: string) => (id === "page-1" ? { id: "page-1", spaceId: "space-1" } : undefined),
}));
// What a non-admin sees through RLS: only their own permission row.
const visiblePermissions = [{ id: "p1", spaceId: "space-1", userId: "u1", role: "editor" }];
vi.mock("@/hooks/use-spaces", () => ({
  useSpacePermissions: (spaceId?: string) => (spaceId === "space-1" ? visiblePermissions : []),
}));

const { useMentionCandidates, resetSpaceMembersCache } = await import("./use-mention-candidates");

describe("useMentionCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSpaceMembersCache();
  });

  it("lists every member of the page's Space from the members RPC, even for a user who can only read their own permission row", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [
        { user_id: "u1", name: "Fachril", role: "editor" },
        { user_id: "u2", name: "Sari", role: "viewer" },
        { user_id: "u4", name: "Budi Santoso", role: "admin" },
      ],
      error: null,
    });

    const { result } = renderHook(() => useMentionCandidates("page-1", "someone-else"));

    await waitFor(() => expect(result.current.map((c) => c.id)).toEqual(["u1", "u2", "u4"]));
    expect(mockSupabase.rpc).toHaveBeenCalledWith("list_space_members", { p_space_id: "space-1" });
    expect(result.current.find((c) => c.id === "u4")?.name).toBe("Budi Santoso");
  });

  it("leaves the author out (mentioning yourself notifies no one)", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [
        { user_id: "u1", name: "Fachril", role: "editor" },
        { user_id: "u2", name: "Sari", role: "viewer" },
      ],
      error: null,
    });

    const { result } = renderHook(() => useMentionCandidates("page-1", "u1"));

    await waitFor(() => expect(result.current.map((c) => c.id)).toEqual(["u2"]));
  });

  it("asks the server once per Space even when several composers mount", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [{ user_id: "u2", name: "Sari", role: "viewer" }], error: null });

    const first = renderHook(() => useMentionCandidates("page-1", "u1"));
    const second = renderHook(() => useMentionCandidates("page-1", "u1"));

    await waitFor(() => expect(first.result.current).toHaveLength(1));
    await waitFor(() => expect(second.result.current).toHaveLength(1));
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("falls back to the permission rows it can read when the RPC is unavailable (migration not run yet)", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useMentionCandidates("page-1", "u2"));

    await waitFor(() => expect(result.current.map((c) => c.id)).toEqual(["u1"]));
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("is empty for an unknown page and never calls the server", () => {
    const { result } = renderHook(() => useMentionCandidates("missing", "u1"));
    expect(result.current).toEqual([]);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });
});
