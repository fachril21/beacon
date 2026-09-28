import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import OrganizationSettingsPage from "./page";
import type { Organization, OrganizationMembership, OrganizationRole, User } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

let mockUser: { id: string } | null = { id: "user-1" };
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: mockUser }) }));

let mockRole: OrganizationRole | null = "admin";
let mockMembers: OrganizationMembership[] = [];
const mockRemoveOrgMember = vi.fn(() => Promise.resolve());
const mockTransferOwnership = vi.fn(() => Promise.resolve());
vi.mock("@/hooks/use-organizations", () => ({
  useCurrentOrganization: () => mockOrganization,
  useOrganizationRole: () => mockRole,
  useOrganizationMembers: () => mockMembers,
  useOrganizationInvitations: () => [],
  useInviteToOrganization: () => vi.fn(),
  useRevokeInvitation: () => vi.fn(),
  useRemoveOrgMember: () => mockRemoveOrgMember,
  useTransferOwnership: () => mockTransferOwnership,
  useMyOrganizations: () => [mockOrganization],
  useOrganizationDomainActions: () => ({ addDomain: vi.fn(), verifyDomain: vi.fn(), removeDomain: vi.fn() }),
  useUpdateOrganizationName: () => vi.fn(),
  useDeleteOrganization: () => vi.fn(),
}));

vi.mock("@/hooks/use-spaces", () => ({ useSpaces: () => [] }));

let mockAllUsers: User[] = [];
vi.mock("@/hooks/use-users", () => ({ useUsers: () => mockAllUsers }));

const mockOrganization: Organization = {
  id: "org-1",
  name: "Dibimbing",
  slug: "dibimbing",
  domain: null,
  isDomainVerified: false,
  pendingDnsToken: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function makeUser(id: string, name: string, email: string): User {
  return { id, name, email, avatarUrl: null, organizationId: "org-1", createdAt: "2026-01-01T00:00:00.000Z" };
}

function makeMembership(userId: string, role: OrganizationRole): OrganizationMembership {
  return { id: `mem-${userId}`, organizationId: "org-1", userId, role, createdAt: "2026-01-01T00:00:00.000Z" };
}

const owner = makeUser("owner-id", "Owner Person", "owner@corp.id");
const admin = makeUser("user-1", "Admin Person", "admin@corp.id");
const member = makeUser("member-id", "Member Person", "member@corp.id");

describe("OrganizationSettingsPage member removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: "user-1" };
    mockAllUsers = [owner, admin, member];
  });

  it("hides the remove button on the current admin's own row but keeps it for other members", () => {
    mockRole = "admin";
    mockMembers = [makeMembership("owner-id", "owner"), makeMembership("user-1", "admin"), makeMembership("member-id", "member")];
    render(<OrganizationSettingsPage />);

    const memberRow = screen.getByTestId("org-member-row-member-id");
    expect(within(memberRow).getByRole("button", { name: "Hapus anggota" })).toBeInTheDocument();

    const selfRow = screen.getByTestId("org-member-row-user-1");
    expect(within(selfRow).queryByRole("button", { name: "Hapus anggota" })).not.toBeInTheDocument();
  });

  it("never shows a remove button on the Owner's own row, even for the Owner themselves", () => {
    mockUser = { id: "owner-id" };
    mockRole = "owner";
    mockMembers = [makeMembership("owner-id", "owner"), makeMembership("user-1", "admin")];
    render(<OrganizationSettingsPage />);

    const ownerRow = screen.getByTestId("org-member-row-owner-id");
    expect(within(ownerRow).queryByRole("button", { name: "Hapus anggota" })).not.toBeInTheDocument();

    const adminRow = screen.getByTestId("org-member-row-user-1");
    expect(within(adminRow).getByRole("button", { name: "Hapus anggota" })).toBeInTheDocument();
  });
});
