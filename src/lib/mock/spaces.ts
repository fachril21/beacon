import type { Space, Permission, PendingInvite } from "@/lib/types";

export const mockSpaces: Space[] = [
  {
    id: "space-mobile-app",
    organizationId: "org-dibimbing",
    name: "Aplikasi Mobile",
    category: "Aplikasi Mobile",
    isPublishable: true,
    createdByUserId: "user-fachril",
    createdAt: "2025-11-03T02:10:00.000Z",
  },
  {
    id: "space-admin-dashboard",
    organizationId: "org-dibimbing",
    name: "Dashboard Admin",
    category: "Internal",
    isPublishable: false,
    createdByUserId: "user-sarah",
    createdAt: "2025-11-06T03:00:00.000Z",
  },
  {
    id: "space-onboarding",
    organizationId: "org-dibimbing",
    name: "Onboarding Karyawan",
    category: "SDM",
    isPublishable: false,
    createdByUserId: "user-fachril",
    createdAt: "2025-11-20T01:00:00.000Z",
  },
  {
    id: "space-lms",
    organizationId: "org-cakrawala",
    name: "Platform LMS",
    category: "Akademik",
    isPublishable: true,
    createdByUserId: "user-maya",
    createdAt: "2026-01-12T05:00:00.000Z",
  },
];

export const mockPermissions: Permission[] = [
  { id: "perm-1", spaceId: "space-mobile-app", userId: "user-fachril", role: "admin" },
  { id: "perm-2", spaceId: "space-mobile-app", userId: "user-sarah", role: "editor" },
  { id: "perm-3", spaceId: "space-mobile-app", userId: "user-budi", role: "viewer" },
  { id: "perm-4", spaceId: "space-admin-dashboard", userId: "user-sarah", role: "admin" },
  { id: "perm-5", spaceId: "space-admin-dashboard", userId: "user-fachril", role: "viewer" },
  { id: "perm-6", spaceId: "space-onboarding", userId: "user-fachril", role: "admin" },
  { id: "perm-7", spaceId: "space-lms", userId: "user-maya", role: "admin" },
  { id: "perm-8", spaceId: "space-lms", userId: "user-andi", role: "editor" },
];

export const mockPendingInvites: PendingInvite[] = [
  {
    id: "invite-1",
    spaceId: "space-mobile-app",
    email: "dedi@dibimbing.id",
    role: "editor",
    invitedByUserId: "user-fachril",
    createdAt: "2026-08-01T03:00:00.000Z",
  },
];
