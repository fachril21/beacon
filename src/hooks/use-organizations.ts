"use client";

import { useSyncExternalStore, useCallback, useEffect } from "react";
import { organizationsStore } from "@/lib/supabase/stores";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapOrganizationRow, type OrganizationRow } from "@/lib/supabase/mappers";
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

/** The signed-in user's own Organization — Flow 7a is always scoped to this, never a picker. */
export function useCurrentOrganization() {
  const { user } = useSession();
  const orgs = useOrganizations();
  return user ? orgs.find((o) => o.id === user.organizationId) : undefined;
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
