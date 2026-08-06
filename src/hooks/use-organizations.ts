"use client";

import { useSyncExternalStore, useCallback } from "react";
import { organizationsStore } from "@/lib/data-store";
import { useSession } from "./use-session";

export function useOrganizations() {
  return useSyncExternalStore(organizationsStore.subscribe, organizationsStore.getState, organizationsStore.getState);
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
    (domain: string) => {
      const claimed = organizationsStore
        .getState()
        .some((o) => o.id !== organizationId && o.domain?.toLowerCase() === domain.toLowerCase());
      if (claimed) {
        throw new Error("Domain ini sudah digunakan oleh Organisasi lain.");
      }
      organizationsStore.setState((prev) =>
        prev.map((o) =>
          o.id === organizationId
            ? { ...o, domain, isDomainVerified: false, pendingDnsToken: randomDnsToken() }
            : o,
        ),
      );
    },
    [organizationId],
  );

  /** Mock verification: succeeds ~60% of the time to demonstrate the "not propagated yet" retry state. */
  const verifyDomain = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 700));
    const succeeded = Math.random() < 0.6;
    if (succeeded) {
      organizationsStore.setState((prev) =>
        prev.map((o) => (o.id === organizationId ? { ...o, isDomainVerified: true, pendingDnsToken: null } : o)),
      );
    }
    return succeeded;
  }, [organizationId]);

  const removeDomain = useCallback(() => {
    organizationsStore.setState((prev) =>
      prev.map((o) => (o.id === organizationId ? { ...o, domain: null, isDomainVerified: false, pendingDnsToken: null } : o)),
    );
  }, [organizationId]);

  return { addDomain, verifyDomain, removeDomain };
}
