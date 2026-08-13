"use client";

import { useCallback, useContext, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { useOrganizations } from "./use-organizations";
import { PublicOrgHeaderContext } from "./public-org-header-context";
import { resolvePublicOrganizationId } from "@/lib/organization-resolution";

const STORAGE_KEY = "beacon.devPublicOrgId";
const SERVER_SNAPSHOT: string | null = null;
const PUBLIC_BASE_PATH = "/public";

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
 * "Which Organization's public domain am I on," plus the `basePath` public
 * links should be built from. Precedence:
 *
 * 1. The real `x-beacon-organization-id` header resolved by proxy.ts's
 *    Host-header middleware (Epic 14a) — set only for a verified
 *    custom-domain request. basePath: "/public".
 * 2. The URL's `orgSlug` param (/public/[orgSlug]/*) — the platform-domain
 *    path, always available regardless of custom-domain verification.
 *    Resolved client-side against the already-loaded Organizations list
 *    (no extra network round-trip). basePath: "/public/{orgSlug}".
 * 3. A dev-only localStorage switcher, for previewing >=2 Organization
 *    contexts locally when neither of the above applies (Epic 7 AC).
 *    basePath: "/public".
 *
 * Whichever of (1)/(2) matches never falls back to "any" Organization and
 * never exposes that other Organizations exist (PRD.md Flow 5) — only (3),
 * the dev switcher, is allowed to see the full list.
 */
export function usePublicOrgContext() {
  const organizations = useOrganizations();
  const storedOrgId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const headerOrgId = useContext(PublicOrgHeaderContext);
  const params = useParams<{ orgSlug?: string }>();
  const orgSlug = typeof params?.orgSlug === "string" ? params.orgSlug : null;

  const setOrgId = useCallback((id: string) => {
    window.localStorage.setItem(STORAGE_KEY, id);
    window.dispatchEvent(new StorageEvent("storage"));
  }, []);

  if (headerOrgId) {
    const organization = organizations.find((o) => o.id === headerOrgId) ?? null;
    return { organization, organizations: organization ? [organization] : [], setOrgId, basePath: PUBLIC_BASE_PATH };
  }

  if (orgSlug) {
    const organization = organizations.find((o) => o.slug === orgSlug) ?? null;
    return {
      organization,
      organizations: organization ? [organization] : [],
      setOrgId,
      basePath: `${PUBLIC_BASE_PATH}/${orgSlug}`,
    };
  }

  const resolvedId = resolvePublicOrganizationId(null, storedOrgId);
  const organization = organizations.find((o) => o.id === resolvedId) ?? organizations[0] ?? null;
  return { organization, organizations, setOrgId, basePath: PUBLIC_BASE_PATH };
}
