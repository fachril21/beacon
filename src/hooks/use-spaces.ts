"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import { spacesStore, permissionsStore, pagesStore, organizationMembershipsStore } from "@/lib/supabase/stores";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapSpaceRow, mapPermissionRow, type SpaceRow, type PermissionRow } from "@/lib/supabase/mappers";
import type { OrganizationRole, Space, SpaceRole } from "@/lib/types";

export function useSpaces(organizationId?: string) {
  const spaces = useSyncExternalStore(spacesStore.subscribe, spacesStore.getState, spacesStore.getState);

  useEffect(() => {
    spacesStore.ensureLoaded(
      "all",
      async () => {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.from("spaces").select("*");
        if (error) throw error;
        return ((data ?? []) as SpaceRow[]).map(mapSpaceRow);
      },
      (error) => console.error("[beacon] failed to load spaces:", error),
    );
  }, []);

  return organizationId ? spaces.filter((s) => s.organizationId === organizationId) : spaces;
}

export function useSpace(id: string | undefined) {
  const spaces = useSpaces();
  return id ? spaces.find((s) => s.id === id) : undefined;
}

/**
 * Spaces accessible to a user.
 * Access rule: Any member of an Organization automatically has access to all
 * Spaces belonging to that Organization.
 */
export function useUserSpaces(userId: string | undefined) {
  const spaces = useSyncExternalStore(spacesStore.subscribe, spacesStore.getState, spacesStore.getState);
  const memberships = useSyncExternalStore(
    organizationMembershipsStore.subscribe,
    organizationMembershipsStore.getState,
    organizationMembershipsStore.getState,
  );

  useEffect(() => {
    spacesStore.ensureLoaded("all", async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from("spaces").select("*");
      if (error) throw error;
      return ((data ?? []) as SpaceRow[]).map(mapSpaceRow);
    });
  }, []);

  if (!userId) return [];
  const myOrgIds = new Set(memberships.filter((m) => m.userId === userId).map((m) => m.organizationId));
  return spaces.filter((s) => myOrgIds.has(s.organizationId));
}

/**
 * useUserSpaces narrowed to one Organization — the single place every
 * Space-listing surface (sidebar, workspace home, ...) should read from,
 * instead of each one re-deriving its own `.filter((s) => s.organizationId
 * === activeOrgId)` inline. A user's Permission rows span every
 * Organization they belong to (Space access no longer implies "current"
 * Organization); this is what actually scopes a list down to what the
 * workspace switcher currently has active. organizationId is typically
 * `useCurrentOrganization()?.id`; omit it to see every accessible Space
 * across every Organization (backward compatible with useUserSpaces alone).
 */
export function useOrganizationSpaces(userId: string | undefined, organizationId: string | undefined) {
  const spaces = useUserSpaces(userId);
  return organizationId ? spaces.filter((s) => s.organizationId === organizationId) : spaces;
}

export interface CreateSpaceInput {
  organizationId: string;
  name: string;
  isPublishable: boolean;
  category?: string | null;
  createdByUserId: string;
}

/**
 * Two writes, in order: the Space row, then the creator's own admin
 * Permission row. RLS's `permissions_insert_admin_or_bootstrap` policy
 * (20260806100100_rls_policies.sql) allows exactly this — a Space's own
 * creator claiming their first permission row — and nothing else, so the
 * order matters: the Space must exist before the bootstrap clause can see
 * `created_by_user_id` match.
 */
export function useCreateSpace() {
  return useCallback(async (input: CreateSpaceInput): Promise<Space> => {
    const supabase = getSupabaseBrowserClient();

    const { data: spaceRow, error: spaceError } = await supabase
      .from("spaces")
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        category: input.category ?? null,
        is_publishable: input.isPublishable,
        created_by_user_id: input.createdByUserId,
      })
      .select()
      .single();
    if (spaceError) throw spaceError;

    const space = mapSpaceRow(spaceRow as SpaceRow);

    const { data: permissionRow, error: permissionError } = await supabase
      .from("permissions")
      .insert({ space_id: space.id, user_id: input.createdByUserId, role: "admin" })
      .select()
      .single();
    if (permissionError) {
      // Without this, a failed bootstrap Permission insert (RLS hiccup,
      // network blip) leaves the Space row behind with no Permission on it
      // at all — permanently orphaned, since nothing else can ever grant
      // access to it. Best-effort: the delete's own outcome doesn't change
      // what we report to the caller either way.
      await supabase.from("spaces").delete().eq("id", space.id);
      throw permissionError;
    }

    spacesStore.setState((prev) => [...prev, space]);
    permissionsStore.setState((prev) => [...prev, mapPermissionRow(permissionRow as PermissionRow)]);

    return space;
  }, []);
}

/**
 * Updates a Space's own settings after creation — its name and its publishable
 * flag (PRD.md Flow 2 step 2's toggle, previously only settable in the New
 * Space modal). Admin-only at the data layer via `spaces_update_admin_only`
 * (20260806100100_rls_policies.sql), so no extra client-side gate is needed
 * here. Flipping `isPublishable` off makes the Space internal-only again — RLS
 * immediately hides its published Pages from the public site, but nothing is
 * deleted.
 */
export function useUpdateSpace() {
  return useCallback(async (id: string, patch: { name?: string; isPublishable?: boolean }) => {
    const supabase = getSupabaseBrowserClient();

    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.isPublishable !== undefined) row.is_publishable = patch.isPublishable;

    const { error } = await supabase.from("spaces").update(row).eq("id", id);
    if (error) throw error;

    spacesStore.setState((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);
}

/**
 * Deletes a Space. Postgres cascades the delete to every Page in it (and, in
 * turn, each Page's screenshot_blocks/versions/comments/feedback) plus the
 * Space's own permissions rows — but the local stores have no way to know
 * that happened server-side, so this drops the same rows from
 * pagesStore/permissionsStore too.
 */
export function useDeleteSpace() {
  return useCallback(async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("spaces").delete().eq("id", id);
    if (error) throw error;

    spacesStore.setState((prev) => prev.filter((s) => s.id !== id));
    pagesStore.setState((prev) => prev.filter((p) => p.spaceId !== id));
    permissionsStore.setState((prev) => prev.filter((p) => p.spaceId !== id));
  }, []);
}

export function useSpacePermissions(spaceId: string | undefined) {
  const permissions = useSyncExternalStore(permissionsStore.subscribe, permissionsStore.getState, permissionsStore.getState);

  useEffect(() => {
    if (!spaceId) return;
    permissionsStore.ensureLoaded(`space:${spaceId}`, async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from("permissions").select("*").eq("space_id", spaceId);
      if (error) throw error;
      return ((data ?? []) as PermissionRow[]).map(mapPermissionRow);
    });
  }, [spaceId]);

  return spaceId ? permissions.filter((p) => p.spaceId === spaceId) : [];
}

const SPACE_ROLE_RANK: Record<SpaceRole, number> = { viewer: 0, editor: 1, admin: 2 };

/** Org owner/admin -> Space admin; Org member -> Space editor. Mirrors beacon.user_space_role in SQL. */
function spaceRoleFromOrgRole(orgRole: OrganizationRole): SpaceRole {
  return orgRole === "owner" || orgRole === "admin" ? "admin" : "editor";
}

function highestSpaceRole(a: SpaceRole | undefined, b: SpaceRole | undefined): SpaceRole | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return SPACE_ROLE_RANK[a] >= SPACE_ROLE_RANK[b] ? a : b;
}

/**
 * The user's effective role in a Space: the HIGHEST of
 *  - the role derived from their Organization role (owner/admin -> 'admin',
 *    member -> 'editor'), and
 *  - any explicit Permission row.
 * Organization membership is therefore a floor — a stale 'viewer' row can
 * never lock an Org admin out. Not in the Org -> null, even with a stale row.
 * Must stay in sync with beacon.user_space_role
 * (supabase/migrations/20261007000000_org_members_full_space_access.sql).
 */
export function useSpaceRole(spaceId: string | undefined, userId: string | undefined): SpaceRole | null {
  const permissions = useSpacePermissions(spaceId);
  const spaces = useSyncExternalStore(spacesStore.subscribe, spacesStore.getState, spacesStore.getState);
  const memberships = useSyncExternalStore(
    organizationMembershipsStore.subscribe,
    organizationMembershipsStore.getState,
    organizationMembershipsStore.getState,
  );

  if (!userId || !spaceId) return null;

  const explicitRole = permissions.find((p) => p.userId === userId)?.role;
  const space = spaces.find((s) => s.id === spaceId);
  const orgMembership = space
    ? memberships.find((m) => m.organizationId === space.organizationId && m.userId === userId)
    : undefined;

  if (!orgMembership) return null;
  return highestSpaceRole(explicitRole, spaceRoleFromOrgRole(orgMembership.role));
}
