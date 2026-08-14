"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import { spacesStore, permissionsStore, pendingInvitesStore, pagesStore } from "@/lib/supabase/stores";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  mapSpaceRow,
  mapPermissionRow,
  mapPendingInviteRow,
  type SpaceRow,
  type PermissionRow,
  type PendingInviteRow,
} from "@/lib/supabase/mappers";
import type { Space, SpaceRole } from "@/lib/types";

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

/** Spaces a given User has an explicit Permission row in (Workspace Home sidebar, Flow 2 step 1). */
export function useUserSpaces(userId: string | undefined) {
  const spaces = useSyncExternalStore(spacesStore.subscribe, spacesStore.getState, spacesStore.getState);
  const permissions = useSyncExternalStore(permissionsStore.subscribe, permissionsStore.getState, permissionsStore.getState);

  useEffect(() => {
    spacesStore.ensureLoaded("all", async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from("spaces").select("*");
      if (error) throw error;
      return ((data ?? []) as SpaceRow[]).map(mapSpaceRow);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    permissionsStore.ensureLoaded(`user:${userId}`, async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from("permissions").select("*").eq("user_id", userId);
      if (error) throw error;
      return ((data ?? []) as PermissionRow[]).map(mapPermissionRow);
    });
  }, [userId]);

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
 * Deletes a Space. Postgres cascades the delete to every Page in it (and, in
 * turn, each Page's screenshot_blocks/versions/comments/feedback), plus the
 * Space's own permissions/pending_invites rows — but the local stores have
 * no way to know that happened server-side, so this drops the same rows from
 * pagesStore/permissionsStore/pendingInvitesStore too.
 */
export function useDeleteSpace() {
  return useCallback(async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("spaces").delete().eq("id", id);
    if (error) throw error;

    spacesStore.setState((prev) => prev.filter((s) => s.id !== id));
    pagesStore.setState((prev) => prev.filter((p) => p.spaceId !== id));
    permissionsStore.setState((prev) => prev.filter((p) => p.spaceId !== id));
    pendingInvitesStore.setState((prev) => prev.filter((i) => i.spaceId !== id));
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

/** The current user's role in a Space, or null if they have no explicit permission row. */
export function useSpaceRole(spaceId: string | undefined, userId: string | undefined): SpaceRole | null {
  const permissions = useSpacePermissions(spaceId);
  if (!userId) return null;
  return permissions.find((p) => p.userId === userId)?.role ?? null;
}

export function useUpdateSpaceRole() {
  return useCallback(async (spaceId: string, userId: string, role: SpaceRole) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("permissions")
      .upsert({ space_id: spaceId, user_id: userId, role }, { onConflict: "space_id,user_id" });
    if (error) throw error;

    permissionsStore.setState((prev) => {
      const exists = prev.some((p) => p.spaceId === spaceId && p.userId === userId);
      if (exists) return prev.map((p) => (p.spaceId === spaceId && p.userId === userId ? { ...p, role } : p));
      return [...prev, { id: `${spaceId}:${userId}`, spaceId, userId, role }];
    });
  }, []);
}

export function useSpacePendingInvites(spaceId: string | undefined) {
  const invites = useSyncExternalStore(pendingInvitesStore.subscribe, pendingInvitesStore.getState, pendingInvitesStore.getState);

  useEffect(() => {
    if (!spaceId) return;
    pendingInvitesStore.ensureLoaded(`space:${spaceId}`, async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from("pending_invites").select("*").eq("space_id", spaceId);
      if (error) throw error;
      return ((data ?? []) as PendingInviteRow[]).map(mapPendingInviteRow);
    });
  }, [spaceId]);

  return spaceId ? invites.filter((i) => i.spaceId === spaceId) : [];
}

export type InviteToSpaceResult = { status: "added" } | { status: "invited"; emailSent: boolean };

/**
 * Posts to /api/spaces/{id}/invite (route.ts) rather than calling the
 * invite_to_space RPC directly, because the "no Account yet" branch needs to
 * send a real notification email via auth.admin.inviteUserByEmail — a
 * service-role-only operation that must run server-side, never with the
 * anon key in the browser. That route still authorizes via the caller's own
 * session (invite_to_space's own space_role_at_least guard), it just also
 * has the privilege to send mail when the RPC alone can't.
 */
export function useInviteToSpace() {
  return useCallback(async (spaceId: string, email: string, role: SpaceRole): Promise<InviteToSpaceResult> => {
    const res = await fetch(`/api/spaces/${spaceId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const body = (await res.json()) as
      | { status: "added"; permission: PermissionRow }
      | { status: "invited"; invite: PendingInviteRow; emailSent: boolean }
      | { error: string };
    if (!res.ok || "error" in body) {
      throw new Error("error" in body ? body.error : "Gagal mengirim undangan.");
    }

    if (body.status === "added") {
      const permission = mapPermissionRow(body.permission);
      permissionsStore.setState((prev) => {
        const exists = prev.some((p) => p.spaceId === permission.spaceId && p.userId === permission.userId);
        return exists ? prev.map((p) => (p.id === permission.id ? permission : p)) : [...prev, permission];
      });
      return { status: "added" };
    }

    pendingInvitesStore.setState((prev) => {
      const invite = mapPendingInviteRow(body.invite);
      const exists = prev.some((i) => i.id === invite.id);
      return exists ? prev.map((i) => (i.id === invite.id ? invite : i)) : [...prev, invite];
    });
    return { status: "invited", emailSent: body.emailSent };
  }, []);
}

export function useCancelInvite() {
  return useCallback(async (inviteId: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("pending_invites").delete().eq("id", inviteId);
    if (error) throw error;

    pendingInvitesStore.setState((prev) => prev.filter((i) => i.id !== inviteId));
  }, []);
}
