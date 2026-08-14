"use client";

import { createContext, type ReactNode } from "react";

/**
 * Populated by the (public) Server Component layout from the real
 * `x-beacon-organization-id` request header (src/proxy.ts) — non-null only
 * on a request that arrived on a verified custom domain. Null on the app's
 * own host (localhost / Vercel preview), where usePublicOrgContext falls
 * back to the existing dev-only localStorage switcher.
 */
export const PublicOrgHeaderContext = createContext<string | null>(null);

/**
 * A Server Component can't render `SomeContext.Provider` directly, even when
 * SomeContext is imported from a "use client" file — the cross-boundary
 * client reference proxies function exports, not property access on an
 * object export, so `.Provider` resolves to undefined at render time. The
 * fix is to keep the Provider usage inside the client file, wrapped in its
 * own Client Component, and have the Server Component render this instead.
 */
export function PublicOrgHeaderProvider({ organizationId, children }: { organizationId: string | null; children: ReactNode }) {
  return <PublicOrgHeaderContext.Provider value={organizationId}>{children}</PublicOrgHeaderContext.Provider>;
}
