import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense } from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SpaceMembersPage from "./page";
import type { Space, Permission, User, OrganizationMembership } from "@/lib/types";

const paramsPromise = Promise.resolve({ spaceId: "space-1" });

const mockToast = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => mockToast(...args), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

let mockUser: { id: string } | null = { id: "user-1" };
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: mockUser }) }));

let mockRole: "viewer" | "editor" | "admin" | null = "admin";
let mockSpace: Space | undefined;
let mockPermissions: Permission[] = [];
const mockUpdateRole = vi.fn(() => Promise.resolve());
const mockAddOrgMemberToSpace = vi.fn(() => Promise.resolve());
const mockRemoveMember = vi.fn(() => Promise.resolve());
vi.mock("@/hooks/use-spaces", () => ({
  useSpace: () => mockSpace,
  useSpaceRole: () => mockRole,
  useSpacePermissions: () => mockPermissions,
  useUpdateSpaceRole: () => mockUpdateRole,
  useAddOrgMemberToSpace: () => mockAddOrgMemberToSpace,
  useRemoveMember: () => mockRemoveMember,
}));

let mockOrganizationMembers: OrganizationMembership[] = [];
vi.mock("@/hooks/use-organizations", () => ({
  useOrganizationMembers: () => mockOrganizationMembers,
}));

let mockAllUsers: User[] = [];
vi.mock("@/hooks/use-users", () => ({
  useUsers: () => mockAllUsers,
}));

const baseSpace: Space = {
  id: "space-1",
  organizationId: "org-1",
  name: "Aplikasi Mobile",
  slug: "test-space",
  category: null,
  isPublishable: false,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function makeUser(id: string, name: string, email: string): User {
  return { id, name, email, avatarUrl: null, organizationId: "org-1", createdAt: "2026-01-01T00:00:00.000Z" };
}

function makeMembership(userId: string): OrganizationMembership {
  return { id: `mem-${userId}`, organizationId: "org-1", userId, role: "member", createdAt: "2026-01-01T00:00:00.000Z" };
}

const admin = makeUser("user-1", "Admin Owner", "admin@corp.id");
const alice = makeUser("alice-id", "Alice Susanto", "alice@corp.id");
const budi = makeUser("budi-id", "Budi Santoso", "budi@corp.id");
const citra = makeUser("citra-id", "Citra Wulandari", "citra@corp.id");

async function renderPage() {
  let utils!: ReturnType<typeof render>;
  await act(async () => {
    utils = render(
      <Suspense fallback={null}>
        <SpaceMembersPage params={paramsPromise} />
      </Suspense>,
    );
  });
  return utils;
}

describe("SpaceMembersPage member picker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: "user-1" };
    mockRole = "admin";
    mockSpace = { ...baseSpace };
    mockPermissions = [{ id: "perm-admin", spaceId: "space-1", userId: "user-1", role: "admin" }];
    mockAllUsers = [admin, alice, budi, citra];
    mockOrganizationMembers = [makeMembership("user-1"), makeMembership("alice-id"), makeMembership("budi-id"), makeMembership("citra-id")];
    mockAddOrgMemberToSpace.mockResolvedValue(undefined);
  });

  it("disables the picker and shows an inline message when every Organization member already has access", async () => {
    mockOrganizationMembers = [makeMembership("user-1"), makeMembership("alice-id")];
    mockPermissions = [
      { id: "perm-admin", spaceId: "space-1", userId: "user-1", role: "admin" },
      { id: "perm-alice", spaceId: "space-1", userId: "alice-id", role: "viewer" },
    ];
    await renderPage();

    const trigger = await screen.findByRole("button", { name: "Semua anggota Organisasi sudah memiliki akses." });
    expect(trigger).toBeDisabled();
    expect(screen.queryByPlaceholderText("Cari nama atau email…")).not.toBeInTheDocument();
  });

  it("lets an admin search addable Organization members by name or email and pick one", async () => {
    mockPermissions = [{ id: "perm-admin", spaceId: "space-1", userId: "user-1", role: "admin" }];
    await renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Pilih anggota Organisasi…" }));
    const searchInput = await screen.findByPlaceholderText("Cari nama atau email…");

    expect(await screen.findByRole("option", { name: /Budi Santoso/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Citra Wulandari/i })).toBeInTheDocument();

    await user.type(searchInput, "citra@corp.id");

    expect(screen.getByRole("option", { name: /Citra Wulandari/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Budi Santoso/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("option", { name: /Citra Wulandari/i }));

    expect(await screen.findByRole("button", { name: "Citra Wulandari" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Cari nama atau email…")).not.toBeInTheDocument();
  });

  it("shows a no-results message when the search matches nobody", async () => {
    await renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Pilih anggota Organisasi…" }));
    const searchInput = await screen.findByPlaceholderText("Cari nama atau email…");
    await user.type(searchInput, "zzz-no-match");

    expect(await screen.findByText("Tidak ditemukan.")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("adds the picked member to the Space with the selected role when Tambah is clicked", async () => {
    await renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Pilih anggota Organisasi…" }));
    await user.click(await screen.findByRole("option", { name: /Budi Santoso/i }));
    await user.click(await screen.findByRole("button", { name: "Tambah" }));

    expect(mockAddOrgMemberToSpace).toHaveBeenCalledWith("space-1", "budi-id", "viewer");
  });
});
