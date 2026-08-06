import type { User } from "@/lib/types";

export const mockUsers: User[] = [
  {
    id: "user-fachril",
    email: "fachril@dibimbing.id",
    name: "Fachril Zulfidar",
    avatarUrl: null,
    organizationId: "org-dibimbing",
    organizationRole: "owner",
    createdAt: "2025-11-03T02:05:00.000Z",
  },
  {
    id: "user-sarah",
    email: "sarah@dibimbing.id",
    name: "Sarah Wijaya",
    avatarUrl: null,
    organizationId: "org-dibimbing",
    organizationRole: "member",
    createdAt: "2025-11-05T06:00:00.000Z",
  },
  {
    id: "user-budi",
    email: "budi@dibimbing.id",
    name: "Budi Santoso",
    avatarUrl: null,
    organizationId: "org-dibimbing",
    organizationRole: "member",
    createdAt: "2025-11-10T08:15:00.000Z",
  },
  {
    id: "user-maya",
    email: "maya@cakrawala.ac.id",
    name: "Maya Kusuma",
    avatarUrl: null,
    organizationId: "org-cakrawala",
    organizationRole: "owner",
    createdAt: "2026-01-12T04:35:00.000Z",
  },
  {
    id: "user-andi",
    email: "andi@cakrawala.ac.id",
    name: "Andi Pratama",
    avatarUrl: null,
    organizationId: "org-cakrawala",
    organizationRole: "member",
    createdAt: "2026-01-15T09:00:00.000Z",
  },
];

/** The user a fresh mock session logs in as (Epic 2). */
export const DEFAULT_MOCK_USER_ID = "user-fachril";
