import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { spacesStore, permissionsStore, pagesStore } from "@/lib/supabase/stores";
import { emptyDoc } from "@/lib/mock/blocknote-content";

const mockSupabase = { from: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => mockSupabase }));

const { useCreateSpace, useUpdateSpaceRole, useAddOrgMemberToSpace, useDeleteSpace } = await import("./use-spaces");

function resetStores() {
  spacesStore.setState([]);
  spacesStore.invalidate("all");
  permissionsStore.setState([]);
  permissionsStore.invalidate("all");
  pagesStore.setState([]);
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

  it("deletes the just-created Space if the bootstrap Permission insert fails, instead of leaving an inaccessible orphan", async () => {
    const spaceRow = {
      id: "space-1",
      organization_id: "org-1",
      name: "Mobile App",
      category: null,
      is_publishable: false,
      created_by_user_id: "user-1",
      created_at: "2026-01-01T00:00:00Z",
    };
    const permissionError = { message: "new row violates row-level security policy for table permissions" };

    const spacesInsert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: spaceRow, error: null }) }) }));
    const permissionsInsert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: permissionError }) }) }));
    const spacesDeleteEq = vi.fn(() => Promise.resolve({ error: null }));
    const spacesDelete = vi.fn(() => ({ eq: spacesDeleteEq }));

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "spaces") return { insert: spacesInsert, delete: spacesDelete };
      if (table === "permissions") return { insert: permissionsInsert };
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => useCreateSpace());
    await expect(
      act(async () => {
        await result.current({
          organizationId: "org-1",
          name: "Mobile App",
          isPublishable: false,
          createdByUserId: "user-1",
        });
      }),
    ).rejects.toEqual(permissionError);

    expect(spacesDelete).toHaveBeenCalled();
    expect(spacesDeleteEq).toHaveBeenCalledWith("id", "space-1");
    expect(spacesStore.getState()).toEqual([]);
    expect(permissionsStore.getState()).toEqual([]);
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

describe("useAddOrgMemberToSpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("grants an existing Organization member Space access via a plain permissions insert (no email path)", async () => {
    const permissionRow = { id: "perm-9", space_id: "space-1", user_id: "user-9", role: "editor" };
    const insert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: permissionRow, error: null }) }) }));
    mockSupabase.from.mockReturnValue({ insert });

    const { result } = renderHook(() => useAddOrgMemberToSpace());
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current("space-1", "user-9", "editor");
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ space_id: "space-1", user_id: "user-9", role: "editor" }),
    );
    expect(outcome).toMatchObject({ id: "perm-9", spaceId: "space-1", userId: "user-9", role: "editor" });
    expect(permissionsStore.getState()).toEqual([
      expect.objectContaining({ id: "perm-9", spaceId: "space-1", userId: "user-9", role: "editor" }),
    ]);
  });

  it("throws the DB's NOT_ORGANIZATION_MEMBER error without touching the store when the target isn't an org member", async () => {
    const dbError = { message: "NOT_ORGANIZATION_MEMBER: user is not a member of this Space's Organization" };
    const insert = vi.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: dbError }) }) }));
    mockSupabase.from.mockReturnValue({ insert });

    const { result } = renderHook(() => useAddOrgMemberToSpace());
    await expect(result.current("space-1", "user-9", "editor")).rejects.toEqual(dbError);
    expect(permissionsStore.getState()).toEqual([]);
  });
});

describe("useRemoveMember", () => {
  const mockDeleteEq = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
    mockDeleteEq.mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({ delete: () => ({ eq: mockDeleteEq }) });
  });

  it("deletes the permissions row and removes it from the local store", async () => {
    permissionsStore.setState([
      { id: "perm-1", spaceId: "space-1", userId: "user-1", role: "admin" },
      { id: "perm-2", spaceId: "space-1", userId: "user-2", role: "viewer" },
    ]);

    const { useRemoveMember } = await import("./use-spaces");
    const { result } = renderHook(() => useRemoveMember());
    await act(async () => {
      await result.current("perm-2");
    });

    expect(mockDeleteEq).toHaveBeenCalledWith("id", "perm-2");
    expect(permissionsStore.getState().map((p) => p.id)).toEqual(["perm-1"]);
  });

  it("throws when Supabase returns an error, without touching the local store", async () => {
    permissionsStore.setState([{ id: "perm-1", spaceId: "space-1", userId: "user-1", role: "admin" }]);
    mockDeleteEq.mockResolvedValue({ error: { message: "permission denied" } });

    const { useRemoveMember } = await import("./use-spaces");
    const { result } = renderHook(() => useRemoveMember());
    await expect(result.current("perm-1")).rejects.toEqual({ message: "permission denied" });
    expect(permissionsStore.getState().map((p) => p.id)).toEqual(["perm-1"]);
  });
});

describe("useDeleteSpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("deletes the row and removes the Space plus everything scoped to it from local stores", async () => {
    spacesStore.setState([
      { id: "space-1", organizationId: "org-1", name: "Mobile App", category: null, isPublishable: false, createdByUserId: "user-1", createdAt: "t" },
      { id: "space-2", organizationId: "org-1", name: "Web App", category: null, isPublishable: false, createdByUserId: "user-1", createdAt: "t" },
    ]);
    pagesStore.setState([
      { id: "page-1", spaceId: "space-1", parentPageId: null, title: "A", order: 0, content: emptyDoc(), visibility: "internal", slug: null, isPublished: false, publishedContentSnapshot: null, publishedAt: null, createdByUserId: "user-1", createdAt: "t", updatedAt: "t" },
      { id: "page-2", spaceId: "space-2", parentPageId: null, title: "B", order: 0, content: emptyDoc(), visibility: "internal", slug: null, isPublished: false, publishedContentSnapshot: null, publishedAt: null, createdByUserId: "user-1", createdAt: "t", updatedAt: "t" },
    ]);
    permissionsStore.setState([
      { id: "perm-1", spaceId: "space-1", userId: "user-1", role: "admin" },
      { id: "perm-2", spaceId: "space-2", userId: "user-1", role: "admin" },
    ]);

    const eqMock = vi.fn(() => Promise.resolve({ error: null }));
    const deleteMock = vi.fn(() => ({ eq: eqMock }));
    mockSupabase.from.mockReturnValue({ delete: deleteMock });

    const { result } = renderHook(() => useDeleteSpace());
    await act(async () => {
      await result.current("space-1");
    });

    expect(deleteMock).toHaveBeenCalled();
    expect(eqMock).toHaveBeenCalledWith("id", "space-1");
    expect(spacesStore.getState().map((s) => s.id)).toEqual(["space-2"]);
    expect(pagesStore.getState().map((p) => p.id)).toEqual(["page-2"]);
    expect(permissionsStore.getState().map((p) => p.id)).toEqual(["perm-2"]);
  });

  it("throws when Supabase returns an error, without touching the local store", async () => {
    spacesStore.setState([
      { id: "space-1", organizationId: "org-1", name: "Mobile App", category: null, isPublishable: false, createdByUserId: "user-1", createdAt: "t" },
    ]);
    const eqMock = vi.fn(() => Promise.resolve({ error: { message: "permission denied" } }));
    mockSupabase.from.mockReturnValue({ delete: () => ({ eq: eqMock }) });

    const { result } = renderHook(() => useDeleteSpace());
    await expect(result.current("space-1")).rejects.toEqual({ message: "permission denied" });
    expect(spacesStore.getState().map((s) => s.id)).toEqual(["space-1"]);
  });
});
