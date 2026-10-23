import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { spacesStore, permissionsStore, pagesStore, organizationMembershipsStore } from "@/lib/supabase/stores";
import { emptyDoc } from "@/lib/mock/blocknote-content";

const mockSupabase = { from: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => mockSupabase }));

const { useCreateSpace, useUpdateSpace, useDeleteSpace, useOrganizationSpaces, useSpaceRole } = await import("./use-spaces");

function resetStores() {
  spacesStore.setState([]);
  spacesStore.invalidate("all");
  permissionsStore.setState([]);
  permissionsStore.invalidate("all");
  organizationMembershipsStore.setState([]);
  organizationMembershipsStore.invalidate("all");
  pagesStore.setState([]);
}

async function markSpacesLoaded() {
  await act(async () => {
    spacesStore.ensureLoaded("all", async () => []);
  });
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
      slug: "mobile-app",
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
      slug: "mobile-app",
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

describe("useUpdateSpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("updates is_publishable on the row and syncs the local store", async () => {
    spacesStore.setState([
      { id: "space-1", organizationId: "org-1", name: "Mobile App", slug: "sp", category: null, isPublishable: false, createdByUserId: "user-1", createdAt: "t" },
    ]);
    const eqMock = vi.fn(() => Promise.resolve({ error: null }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    mockSupabase.from.mockReturnValue({ update: updateMock });

    const { result } = renderHook(() => useUpdateSpace());
    await act(async () => {
      await result.current("space-1", { isPublishable: true });
    });

    expect(updateMock).toHaveBeenCalledWith({ is_publishable: true });
    expect(eqMock).toHaveBeenCalledWith("id", "space-1");
    expect(spacesStore.getState()).toEqual([expect.objectContaining({ id: "space-1", isPublishable: true })]);
  });

  it("updates name on the row and syncs the local store", async () => {
    spacesStore.setState([
      { id: "space-1", organizationId: "org-1", name: "Mobile App", slug: "sp", category: null, isPublishable: false, createdByUserId: "user-1", createdAt: "t" },
    ]);
    const eqMock = vi.fn(() => Promise.resolve({ error: null }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    mockSupabase.from.mockReturnValue({ update: updateMock });

    const { result } = renderHook(() => useUpdateSpace());
    await act(async () => {
      await result.current("space-1", { name: "Mobile App v2" });
    });

    expect(updateMock).toHaveBeenCalledWith({ name: "Mobile App v2" });
    expect(eqMock).toHaveBeenCalledWith("id", "space-1");
    expect(spacesStore.getState()).toEqual([expect.objectContaining({ id: "space-1", name: "Mobile App v2" })]);
  });

  it("throws when Supabase returns an error, without touching the local store", async () => {
    spacesStore.setState([
      { id: "space-1", organizationId: "org-1", name: "Mobile App", slug: "sp", category: null, isPublishable: true, createdByUserId: "user-1", createdAt: "t" },
    ]);
    const eqMock = vi.fn(() => Promise.resolve({ error: { message: "permission denied" } }));
    mockSupabase.from.mockReturnValue({ update: () => ({ eq: eqMock }) });

    const { result } = renderHook(() => useUpdateSpace());
    await expect(result.current("space-1", { isPublishable: false })).rejects.toEqual({ message: "permission denied" });
    expect(spacesStore.getState()).toEqual([expect.objectContaining({ id: "space-1", isPublishable: true })]);
  });
});

describe("useDeleteSpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("deletes the row and removes the Space plus everything scoped to it from local stores", async () => {
    spacesStore.setState([
      { id: "space-1", organizationId: "org-1", name: "Mobile App", slug: "sp", category: null, isPublishable: false, createdByUserId: "user-1", createdAt: "t" },
      { id: "space-2", organizationId: "org-1", name: "Web App", slug: "sp", category: null, isPublishable: false, createdByUserId: "user-1", createdAt: "t" },
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
      { id: "space-1", organizationId: "org-1", name: "Mobile App", slug: "sp", category: null, isPublishable: false, createdByUserId: "user-1", createdAt: "t" },
    ]);
    const eqMock = vi.fn(() => Promise.resolve({ error: { message: "permission denied" } }));
    mockSupabase.from.mockReturnValue({ delete: () => ({ eq: eqMock }) });

    const { result } = renderHook(() => useDeleteSpace());
    await expect(result.current("space-1")).rejects.toEqual({ message: "permission denied" });
    expect(spacesStore.getState().map((s) => s.id)).toEqual(["space-1"]);
  });
});

describe("useOrganizationSpaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("returns only the Spaces belonging to the given Organization, even when the caller has access to Spaces in other Organizations too", async () => {
    organizationMembershipsStore.setState([
      { id: "mem-1", organizationId: "org-1", userId: "user-1", role: "admin", createdAt: "t" },
      { id: "mem-2", organizationId: "org-2", userId: "user-1", role: "admin", createdAt: "t" },
    ]);
    const spaceRows: import("@/lib/supabase/mappers").SpaceRow[] = [
      { id: "space-1", organization_id: "org-1", name: "Org 1 Space", slug: "sp", category: null, is_publishable: false, created_by_user_id: "user-1", created_at: "t" },
      { id: "space-2", organization_id: "org-2", name: "Org 2 Space", slug: "sp", category: null, is_publishable: false, created_by_user_id: "user-1", created_at: "t" },
    ];
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "spaces") return { select: () => Promise.resolve({ data: spaceRows, error: null }) };
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => useOrganizationSpaces("user-1", "org-1"));
    await waitFor(() => expect(result.current.map((s) => s.id)).toEqual(["space-1"]));
  });

  it("returns every accessible Space when organizationId is undefined (backward compatible)", async () => {
    organizationMembershipsStore.setState([
      { id: "mem-1", organizationId: "org-1", userId: "user-1", role: "admin", createdAt: "t" },
      { id: "mem-2", organizationId: "org-2", userId: "user-1", role: "admin", createdAt: "t" },
    ]);
    const spaceRows: import("@/lib/supabase/mappers").SpaceRow[] = [
      { id: "space-1", organization_id: "org-1", name: "Org 1 Space", slug: "sp", category: null, is_publishable: false, created_by_user_id: "user-1", created_at: "t" },
      { id: "space-2", organization_id: "org-2", name: "Org 2 Space", slug: "sp", category: null, is_publishable: false, created_by_user_id: "user-1", created_at: "t" },
    ];
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "spaces") return { select: () => Promise.resolve({ data: spaceRows, error: null }) };
      throw new Error(`unexpected table ${table}`);
    });

    const { result } = renderHook(() => useOrganizationSpaces("user-1", undefined));
    await waitFor(() => expect(result.current).toHaveLength(2));
  });

  it("does not expose a Space from a stale permission after Organization membership is removed", async () => {
    await markSpacesLoaded();
    spacesStore.setState([
      { id: "space-1", organizationId: "org-1", name: "Former Org Space", slug: "sp", category: null, isPublishable: true, createdByUserId: "user-2", createdAt: "t" },
    ]);
    permissionsStore.setState([
      { id: "perm-1", spaceId: "space-1", userId: "user-1", role: "admin" },
    ]);

    const { result } = renderHook(() => useOrganizationSpaces("user-1", undefined));

    expect(result.current).toEqual([]);
  });
});

describe("Organization-level automatic space access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStores();
  });

  it("automatically grants access to all Spaces in an Organization when user is an org member with no explicit permissions row", async () => {
    await markSpacesLoaded();
    organizationMembershipsStore.setState([
      { id: "mem-1", organizationId: "org-1", userId: "user-member", role: "member", createdAt: "t" },
    ]);
    spacesStore.setState([
      { id: "space-1", organizationId: "org-1", name: "Space 1", slug: "s1", category: null, isPublishable: false, createdByUserId: "user-1", createdAt: "t" },
      { id: "space-2", organizationId: "org-1", name: "Space 2", slug: "s2", category: null, isPublishable: false, createdByUserId: "user-1", createdAt: "t" },
      { id: "space-3", organizationId: "org-2", name: "Other Org Space", slug: "s3", category: null, isPublishable: false, createdByUserId: "user-1", createdAt: "t" },
    ]);
    permissionsStore.setState([
      { id: "stale-perm", spaceId: "space-1", userId: "user-stranger", role: "admin" },
    ]);

    const { result } = renderHook(() => useOrganizationSpaces("user-member", "org-1"));
    expect(result.current.map((s) => s.id)).toEqual(["space-1", "space-2"]);
  });

  it("derives space role automatically from organization role: admin for owner/admin, editor for member", async () => {
    await markSpacesLoaded();
    organizationMembershipsStore.setState([
      { id: "mem-admin", organizationId: "org-1", userId: "user-admin", role: "admin", createdAt: "t" },
      { id: "mem-member", organizationId: "org-1", userId: "user-member", role: "member", createdAt: "t" },
    ]);
    spacesStore.setState([
      { id: "space-1", organizationId: "org-1", name: "Space 1", slug: "s1", category: null, isPublishable: false, createdByUserId: "user-1", createdAt: "t" },
    ]);
    permissionsStore.setState([]);

    const { result: adminRole } = renderHook(() => useSpaceRole("space-1", "user-admin"));
    expect(adminRole.current).toBe("admin");

    const { result: memberRole } = renderHook(() => useSpaceRole("space-1", "user-member"));
    expect(memberRole.current).toBe("editor");

    const { result: strangerRole } = renderHook(() => useSpaceRole("space-1", "user-stranger"));
    expect(strangerRole.current).toBeNull();
  });
});
