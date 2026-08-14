"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import { organizationsStore, organizationMembershipsStore, organizationInvitationsStore } from "@/lib/supabase/stores";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  mapOrganizationRow,
  mapOrganizationMembershipRow,
  mapOrganizationInvitationRow,
  type OrganizationRow,
  type OrganizationMembershipRow,
  type OrganizationInvitationRow,
} from "@/lib/supabase/mappers";
import type { InvitableOrganizationRole, OrganizationRole } from "@/lib/types";
import { useSession } from "./use-session";

const ALL_ORGANIZATIONS_KEY = "all";

export function useOrganizations() {
  const orgs = useSyncExternalStore(organizationsStore.subscribe, organizationsStore.getState, organizationsStore.getState);

  useEffect(() => {
    organizationsStore.ensureLoaded(
      ALL_ORGANIZATIONS_KEY,
      async () => {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.from("organizations").select("*");
        if (error) throw error;
        return ((data ?? []) as OrganizationRow[]).map(mapOrganizationRow);
      },
      (error) => console.error("[beacon] failed to load organizations:", error),
    );
  }, []);

  return orgs;
}

export function useOrganization(id: string | undefined) {
  const orgs = useOrganizations();
  return id ? orgs.find((o) => o.id === id) : undefined;
}

/** Every Organization the current user has an organization_memberships row in — a user may belong to more than one. */
export function useMyOrganizations() {
  const { user } = useSession();
  const orgs = useOrganizations();
  const memberships = useSyncExternalStore(
    organizationMembershipsStore.subscribe,
    organizationMembershipsStore.getState,
    organizationMembershipsStore.getState,
  );

  useEffect(() => {
    if (!user) return;
    organizationMembershipsStore.ensureLoaded(`user:${user.id}`, async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from("organization_memberships").select("*").eq("user_id", user.id);
      if (error) throw error;
      return ((data ?? []) as OrganizationMembershipRow[]).map(mapOrganizationMembershipRow);
    });
  }, [user]);

  if (!user) return [];
  const myOrgIds = new Set(memberships.filter((m) => m.userId === user.id).map((m) => m.organizationId));
  return orgs.filter((o) => myOrgIds.has(o.id));
}

/**
 * The signed-in user's "active" Organization for single-org-scoped UI (e.g.
 * Organization Settings) — their last-selected org (profiles.organization_id,
 * a convenience pointer only) if they're still a member of it, else the
 * first Organization they belong to. Never a fallback to an Organization
 * they aren't a member of.
 */
export function useCurrentOrganization() {
  const { user } = useSession();
  const myOrgs = useMyOrganizations();
  if (!user) return undefined;
  return myOrgs.find((o) => o.id === user.organizationId) ?? myOrgs[0];
}

/** The current user's role in a given Organization, or null with no membership row. */
export function useOrganizationRole(organizationId: string | undefined, userId: string | undefined): OrganizationRole | null {
  const memberships = useSyncExternalStore(
    organizationMembershipsStore.subscribe,
    organizationMembershipsStore.getState,
    organizationMembershipsStore.getState,
  );
  if (!organizationId || !userId) return null;
  return memberships.find((m) => m.organizationId === organizationId && m.userId === userId)?.role ?? null;
}

export interface CreateOrganizationInput {
  name: string;
  createdByUserId: string;
}

/**
 * Two writes, in order: the Organization row, then the creator's own OWNER
 * membership row. Mirrors useCreateSpace's bootstrap shape — RLS's
 * organization_memberships_insert_owner_or_bootstrap policy allows exactly
 * this (the org's own creator claiming the founding OWNER row while zero
 * membership rows exist yet), so the Organization must exist before the
 * bootstrap clause can see it.
 */
export function useCreateOrganization() {
  return useCallback(async (input: CreateOrganizationInput) => {
    const supabase = getSupabaseBrowserClient();

    const { data: orgRow, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: input.name })
      .select()
      .single();
    if (orgError) throw orgError;

    const organization = mapOrganizationRow(orgRow as OrganizationRow);

    const { data: membershipRow, error: membershipError } = await supabase
      .from("organization_memberships")
      .insert({ organization_id: organization.id, user_id: input.createdByUserId, role: "owner" })
      .select()
      .single();
    if (membershipError) {
      // Same orphan-prevention as useCreateSpace: without this, a failed
      // bootstrap membership insert leaves the Organization row behind with
      // no member on it at all — permanently inaccessible.
      await supabase.from("organizations").delete().eq("id", organization.id);
      throw membershipError;
    }

    organizationsStore.setState((prev) => [...prev, organization]);
    organizationMembershipsStore.setState((prev) => [...prev, mapOrganizationMembershipRow(membershipRow as OrganizationMembershipRow)]);

    return organization;
  }, []);
}

export function useOrganizationMembers(organizationId: string | undefined) {
  const memberships = useSyncExternalStore(
    organizationMembershipsStore.subscribe,
    organizationMembershipsStore.getState,
    organizationMembershipsStore.getState,
  );

  useEffect(() => {
    if (!organizationId) return;
    organizationMembershipsStore.ensureLoaded(`org:${organizationId}`, async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from("organization_memberships").select("*").eq("organization_id", organizationId);
      if (error) throw error;
      return ((data ?? []) as OrganizationMembershipRow[]).map(mapOrganizationMembershipRow);
    });
  }, [organizationId]);

  return organizationId ? memberships.filter((m) => m.organizationId === organizationId) : [];
}

export function useOrganizationInvitations(organizationId: string | undefined) {
  const invitations = useSyncExternalStore(
    organizationInvitationsStore.subscribe,
    organizationInvitationsStore.getState,
    organizationInvitationsStore.getState,
  );

  useEffect(() => {
    if (!organizationId) return;
    organizationInvitationsStore.ensureLoaded(`org:${organizationId}`, async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from("organization_invitations").select("*").eq("organization_id", organizationId);
      if (error) throw error;
      return ((data ?? []) as OrganizationInvitationRow[]).map(mapOrganizationInvitationRow);
    });
  }, [organizationId]);

  return organizationId ? invitations.filter((i) => i.organizationId === organizationId) : [];
}

export type InviteToOrganizationResult = { status: "added" } | { status: "invited"; emailSent: boolean };

/**
 * Posts to /api/organizations/{id}/invite rather than calling
 * invite_to_organization directly, for the same reason useInviteToSpace
 * posts to a route instead of calling invite_to_space directly: the
 * "no Account yet" branch needs a real notification email via
 * auth.admin.inviteUserByEmail, a service-role-only operation.
 */
export function useInviteToOrganization() {
  return useCallback(
    async (organizationId: string, email: string, role: InvitableOrganizationRole): Promise<InviteToOrganizationResult> => {
      const res = await fetch(`/api/organizations/${organizationId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const body = (await res.json()) as
        | { status: "added"; membership: OrganizationMembershipRow }
        | { status: "invited"; invite: OrganizationInvitationRow; emailSent: boolean }
        | { error: string };
      if (!res.ok || "error" in body) {
        throw new Error("error" in body ? body.error : "Gagal mengirim undangan.");
      }

      if (body.status === "added") {
        const membership = mapOrganizationMembershipRow(body.membership);
        organizationMembershipsStore.setState((prev) => {
          const exists = prev.some((m) => m.organizationId === membership.organizationId && m.userId === membership.userId);
          return exists ? prev.map((m) => (m.id === membership.id ? membership : m)) : [...prev, membership];
        });
        return { status: "added" };
      }

      organizationInvitationsStore.setState((prev) => {
        const invite = mapOrganizationInvitationRow(body.invite);
        const exists = prev.some((i) => i.id === invite.id);
        return exists ? prev.map((i) => (i.id === invite.id ? invite : i)) : [...prev, invite];
      });
      return { status: "invited", emailSent: body.emailSent };
    },
    [],
  );
}

/** Revokes a PENDING invitation — a plain UPDATE, covered by organization_invitations_all_owner_or_admin. */
export function useRevokeInvitation() {
  return useCallback(async (invitationId: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("organization_invitations").update({ status: "revoked" }).eq("id", invitationId);
    if (error) throw error;

    organizationInvitationsStore.setState((prev) =>
      prev.map((i) => (i.id === invitationId ? { ...i, status: "revoked" as const } : i)),
    );
  }, []);
}

/** Removes a member from an Organization (or lets them leave). Rejects with CANNOT_REMOVE_OWNER if the target is the current OWNER. */
export function useRemoveOrgMember() {
  return useCallback(async (organizationId: string, userId: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("remove_organization_member", {
      p_organization_id: organizationId,
      p_user_id: userId,
    });
    if (error) throw new Error(error.message);

    organizationMembershipsStore.setState((prev) =>
      prev.filter((m) => !(m.organizationId === organizationId && m.userId === userId)),
    );
  }, []);
}

/** Transfers OWNER to another member; the caller (current OWNER) becomes an ADMIN. */
export function useTransferOwnership() {
  return useCallback(async (organizationId: string, newOwnerUserId: string) => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("transfer_organization_ownership", {
      p_organization_id: organizationId,
      p_new_owner_user_id: newOwnerUserId,
    });
    if (error) throw new Error(error.message);

    organizationMembershipsStore.setState((prev) =>
      prev.map((m) => {
        if (m.organizationId !== organizationId) return m;
        if (m.userId === newOwnerUserId) return { ...m, role: "owner" as const };
        if (m.role === "owner") return { ...m, role: "admin" as const };
        return m;
      }),
    );
  }, []);
}

/** Accepts an Organization invite by token — the signed-in caller's own email must match the invite. */
export function useAcceptOrganizationInvite() {
  return useCallback(async (token: string) => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("accept_organization_invite", { p_token: token });
    if (error) throw new Error(error.message);
    return data as { status: string; membership?: OrganizationMembershipRow };
  }, []);
}

function randomDnsToken() {
  return `beacon-verify=${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

export function useOrganizationDomainActions(organizationId: string) {
  const addDomain = useCallback(
    async (domain: string) => {
      const supabase = getSupabaseBrowserClient();
      const pendingDnsToken = randomDnsToken();
      const { error } = await supabase
        .from("organizations")
        .update({ domain, is_domain_verified: false, pending_dns_token: pendingDnsToken })
        .eq("id", organizationId);

      if (error) {
        // Postgres unique_violation on organizations.domain (schema-enforced,
        // not just a client-side check) — see 20260806100000_initial_schema.sql.
        if ((error as { code?: string }).code === "23505") {
          throw new Error("Domain ini sudah digunakan oleh Organisasi lain.");
        }
        throw error;
      }

      organizationsStore.setState((prev) =>
        prev.map((o) => (o.id === organizationId ? { ...o, domain, isDomainVerified: false, pendingDnsToken } : o)),
      );
    },
    [organizationId],
  );

  /**
   * Calls the real DNS TXT-based ownership check (src/lib/dns/verify-domain.ts,
   * via /api/organizations/[id]/verify-domain) — Vercel Domains API
   * registration/SSL provisioning is a separate, still-deferred concern (no
   * Vercel account is available in this environment), but this is a genuine
   * verification, not the old randomized placeholder.
   */
  const verifyDomain = useCallback(async () => {
    const res = await fetch(`/api/organizations/${organizationId}/verify-domain`, { method: "POST" });
    const body = (await res.json()) as { verified?: boolean; reason?: string | null; error?: string };
    if (!res.ok) {
      throw new Error(body.error ?? "Verifikasi domain gagal.");
    }
    if (body.verified) {
      organizationsStore.setState((prev) =>
        prev.map((o) => (o.id === organizationId ? { ...o, isDomainVerified: true, pendingDnsToken: null } : o)),
      );
    }
    return Boolean(body.verified);
  }, [organizationId]);

  const removeDomain = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("organizations")
      .update({ domain: null, is_domain_verified: false, pending_dns_token: null })
      .eq("id", organizationId);
    if (error) throw error;

    organizationsStore.setState((prev) =>
      prev.map((o) => (o.id === organizationId ? { ...o, domain: null, isDomainVerified: false, pendingDnsToken: null } : o)),
    );
  }, [organizationId]);

  return { addDomain, verifyDomain, removeDomain };
}
