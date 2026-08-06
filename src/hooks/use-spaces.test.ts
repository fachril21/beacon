import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { spacesStore, permissionsStore, pendingInvitesStore } from "@/lib/supabase/stores";

const mockSupabase = { from: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => mockSupabase }));

const { useCreateSpace, useUpdateSpaceRole, useInviteToSpace } = await import("./use-spaces");

function resetStores() {
  spacesStore.setState([]);
  spacesStore.invalidate("all");
  permissionsStore.setState([]);
  permissionsStore.invalidate("all");
  pendingInvitesStore.setState([]);
}

describe("useCreateSpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("inserts the Space row, then bootstraps the creator's own admin permission row", async () => {
    const spaceRow = {
      id: "space-1",
      organization_id: "org-1",
      name: "Mobile App",
      category: null,
      is_publishable: false,
      created_by_user_id: "user-1",
      created_at: "2026-01-01T00:00:00Z",
    };
    const permissionRow = { id: "perm-1", space_id: "space-1", user_id: "user-1", role: "admin" };

    const spacesInsert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: spaceRow, error: null }) }) }));
    const permissionsInsert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: permissionRow, error: null }) }) }));

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "spaces") return { insert: spacesInsert };
      if (table === "permissions") return { insert: permissionsInsert };
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => useCreateSpace());
    let created: unknown;
    await act(async () => {
      created = await result.current({
        organizationId: "org-1",
        name: "Mobile App",
        isPublishable: false,
        createdByUserId: "user-1",
      });
    });

    expect(spacesInsert).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: "org-1", name: "Mobile App", created_by_user_id: "user-1" }),
    );
    expect(permissionsInsert).toHaveBeenCalledWith(
      expect.objectContaining({ space_id: "space-1", user_id: "user-1", role: "admin" }),
    );
    expect(created).toMatchObject({ id: "space-1", name: "Mobile App" });
    expect(spacesStore.getState()).toEqual([expect.objectContaining({ id: "space-1" })]);
    expect(permissionsStore.getState()).toEqual([expect.objectContaining({ spaceId: "space-1", role: "admin" })]);
  });
});

describe("useUpdateSpaceRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("upserts on (space_id, user_id) so it works whether or not a permission row already exists", async () => {
    const upsert = vi.fn(() => Promise.resolve({ error: null }));
    mockSupabase.from.mockReturnValue({ upsert });

    const { result } = renderHook(() => useUpdateSpaceRole());
    await act(async () => {
      await result.current("space-1", "user-2", "editor");
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ space_id: "space-1", user_id: "user-2", role: "editor" }),
      expect.objectContaining({ onConflict: "space_id,user_id" }),
    );
  });
});

describe("useInviteToSpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("inserts a pending_invites row and patches the local store", async () => {
    const inviteRow = {
      id: "invite-1",
      space_id: "space-1",
      email: "new@dibimbing.id",
      role: "viewer",
      invited_by_user_id: "user-1",
      created_at: "2026-01-01T00:00:00Z",
    };
    mockSupabase.from.mockReturnValue({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: inviteRow, error: null }) }) }),
    });

    const { result } = renderHook(() => useInviteToSpace());
    await act(async () => {
      await result.current("space-1", "new@dibimbing.id", "viewer", "user-1");
    });

    expect(pendingInvitesStore.getState()).toEqual([
      expect.objectContaining({ id: "invite-1", email: "new@dibimbing.id", role: "viewer" }),
    ]);
  });
});
