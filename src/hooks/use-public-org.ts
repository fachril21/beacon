"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useOrganizations } from "./use-organizations";

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
 * Stage 1 has no real Host-header domain routing (that's Epic 14a, Stage 2) —
 * this dev-only switcher simulates "which Organization's public domain am I
 * on" so the public site can be previewed under >=2 Organization contexts
 * without content bleeding between them (Epic 7 AC). Reads localStorage via
 * useSyncExternalStore so the client's first render matches the server's
 * (both start from `null`) and only diverges after hydration completes.
 */
export function usePublicOrgContext() {
  const organizations = useOrganizations();
  const storedOrgId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setOrgId = useCallback((id: string) => {
    window.localStorage.setItem(STORAGE_KEY, id);
    window.dispatchEvent(new StorageEvent("storage"));
  }, []);

  const organization = organizations.find((o) => o.id === storedOrgId) ?? organizations[0] ?? null;

  return { organization, organizations, setOrgId };
}
