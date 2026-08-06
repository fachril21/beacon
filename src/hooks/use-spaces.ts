"use client";

import { useSyncExternalStore, useCallback } from "react";
import { spacesStore, permissionsStore, pendingInvitesStore, nextId } from "@/lib/data-store";
import type { Space, SpaceRole } from "@/lib/types";

export function useSpaces(organizationId?: string) {
  const spaces = useSyncExternalStore(spacesStore.subscribe, spacesStore.getState, spacesStore.getState);
  return organizationId ? spaces.filter((s) => s.organizationId === organizationId) : spaces;
}

export function useSpace(id: string | undefined) {
  const spaces = useSpaces();
  return id ? spaces.find((s) => s.id === id) : undefined;
}

/** Spaces a given User has an explicit Permission row in (Workspace Home sidebar, Flow 2 step 1). */
export function useUserSpaces(userId: string | undefined) {
  const spaces = useSyncExternalStore(spacesStore.subscribe, spacesStore.getState, spacesStore.getState);
  const permissions = useSyncExternalStore(permissionsStore.subscribe, permissionsStore.getState, permissionsStore.getState);
  if (!userId) return [];
  const accessibleIds = new Set(permissions.filter((p) => p.userId === userId).map((p) => p.spaceId));
  return spaces.filter((s) => accessibleIds.has(s.id));
}

export interface CreateSpaceInput {
  organizationId: string;
  name: string;
  isPublishable: boolean;
  category?: string | null;
  createdByUserId: string;
}

export function useCreateSpace() {
  return useCallback((input: CreateSpaceInput): Space => {
    const space: Space = {
      id: nextId("space"),
      organizationId: input.organizationId,
      name: input.name,
      category: input.category ?? null,
      isPublishable: input.isPublishable,
      createdByUserId: input.createdByUserId,
      createdAt: new Date().toISOString(),
    };
    spacesStore.setState((prev) => [...prev, space]);
    permissionsStore.setState((prev) => [
      ...prev,
      { id: nextId("perm"), spaceId: space.id, userId: input.createdByUserId, role: "admin" as SpaceRole },
    ]);
    return space;
  }, []);
}

export function useSpacePermissions(spaceId: string | undefined) {
  const permissions = useSyncExternalStore(permissionsStore.subscribe, permissionsStore.getState, permissionsStore.getState);
  return spaceId ? permissions.filter((p) => p.spaceId === spaceId) : [];
}

/** The current user's role in a Space, or null if they have no explicit permission row. */
export function useSpaceRole(spaceId: string | undefined, userId: string | undefined): SpaceRole | null {
  const permissions = useSpacePermissions(spaceId);
  if (!userId) return null;
  return permissions.find((p) => p.userId === userId)?.role ?? null;
}

export function useUpdateSpaceRole() {
  return useCallback((spaceId: string, userId: string, role: SpaceRole) => {
    permissionsStore.setState((prev) => {
      const exists = prev.some((p) => p.spaceId === spaceId && p.userId === userId);
      if (exists) {
        return prev.map((p) => (p.spaceId === spaceId && p.userId === userId ? { ...p, role } : p));
      }
      return [...prev, { id: nextId("perm"), spaceId, userId, role }];
    });
  }, []);
}

export function useSpacePendingInvites(spaceId: string | undefined) {
  const invites = useSyncExternalStore(pendingInvitesStore.subscribe, pendingInvitesStore.getState, pendingInvitesStore.getState);
  return spaceId ? invites.filter((i) => i.spaceId === spaceId) : [];
}

export function useInviteToSpace() {
  return useCallback((spaceId: string, email: string, role: SpaceRole, invitedByUserId: string) => {
    pendingInvitesStore.setState((prev) => [
      ...prev,
      { id: nextId("invite"), spaceId, email, role, invitedByUserId, createdAt: new Date().toISOString() },
    ]);
  }, []);
}
