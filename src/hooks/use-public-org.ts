"use client";

import { useCallback, useContext, useSyncExternalStore } from "react";
import { useOrganizations } from "./use-organizations";
import { PublicOrgHeaderContext } from "./public-org-header-context";
import { resolvePublicOrganizationId } from "@/lib/organization-resolution";

const STORAGE_KEY = "beacon.devPublicOrgId";
const SERVER_SNAPSHOT: string | null = null;

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

function getSnapshot(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot(): string | null {
  return SERVER_SNAPSHOT;
}

/**
 * "Which Organization's public domain am I on." Prefers the real
 * `x-beacon-organization-id` header resolved by proxy.ts's Host-header
 * middleware (Epic 14a) — set only for a verified custom-domain request.
 * Falls back to a dev-only localStorage switcher when no header is present
 * (the app's own host: localhost / Vercel preview), so the public site can
 * still be previewed under >=2 Organization contexts locally (Epic 7 AC).
 * Reads localStorage via useSyncExternalStore so the client's first render
 * matches the server's (both start from `null`) and only diverges after
 * hydration completes.
 */
export function usePublicOrgContext() {
  const organizations = useOrganizations();
  const storedOrgId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const headerOrgId = useContext(PublicOrgHeaderContext);

  const setOrgId = useCallback((id: string) => {
    window.localStorage.setItem(STORAGE_KEY, id);
    window.dispatchEvent(new StorageEvent("storage"));
  }, []);

  if (headerOrgId) {
    // A real custom-domain request must never reveal that other
    // Organizations exist (PRD.md Flow 5) or fall back to an unrelated one.
    const organization = organizations.find((o) => o.id === headerOrgId) ?? null;
    return { organization, organizations: organization ? [organization] : [], setOrgId };
  }

  const resolvedId = resolvePublicOrganizationId(null, storedOrgId);
  const organization = organizations.find((o) => o.id === resolvedId) ?? organizations[0] ?? null;
  return { organization, organizations, setOrgId };
}
