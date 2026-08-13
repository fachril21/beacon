/**
 * Host-header -> Organization resolution (PRD.md Epic 14a, PROJECT.md §9.3
 * "Multi-domain routing"). Pure logic only — src/middleware.ts wires this to
 * a real request and a Supabase lookup. Live Vercel Domains API
 * registration/DNS verification is a separate, still-deferred concern (see
 * useOrganizationDomainActions.verifyDomain's TODO) — this module only
 * decides "which Organization, if any, does this Host header belong to."
 */
import type { Organization } from "@/lib/types";

export function normalizeHost(host: string): string {
  return host.toLowerCase().split(":")[0];
}

/**
 * True for the app's own workspace/auth/API domain (and any Vercel preview
 * deployment of it) — these must never be treated as a custom Organization
 * domain, or the workspace itself would 404 as "not configured."
 */
export function isAppHost(host: string, appHosts: string[]): boolean {
  const normalized = normalizeHost(host);
  return appHosts.some((appHost) => {
    const normalizedAppHost = normalizeHost(appHost);
    if (normalized === normalizedAppHost) return true;
    // Vercel preview deployments: <branch>-<team>.vercel.app for a
    // beacon.vercel.app production host.
    if (normalizedAppHost.endsWith(".vercel.app")) {
      const rootDomain = normalizedAppHost.split(".").slice(-2).join(".");
      return normalized.endsWith(`.${rootDomain}`) || normalized === rootDomain;
    }
    return false;
  });
}

/**
 * Resolves a Host header to a verified Organization, or null. Never returns
 * an unverified Organization — a request on a domain that's been added but
 * not yet DNS-verified must get the "not configured" state (Flow 7a),
 * exactly like an unrecognized domain, not a fallback to real content.
 */
export function resolveOrganizationForHost(host: string, organizations: Organization[]): Organization | null {
  const normalized = normalizeHost(host);
  const match = organizations.find((org) => org.domain && normalizeHost(org.domain) === normalized);
  if (!match || !match.isDomainVerified) return null;
  return match;
}

/**
 * Which Organization id the public site (src/app/(public)/*) should render
 * for the current request. The `x-beacon-organization-id` header (set by
 * proxy.ts only for a verified custom-domain request) always wins over the
 * dev-only localStorage switcher (use-public-org.ts) — a real visitor on a
 * real domain must never be affected by another developer's local preview
 * state, and the two are never blended.
 */
export function resolvePublicOrganizationId(
  headerOrganizationId: string | null,
  devSwitcherOrganizationId: string | null,
): string | null {
  return headerOrganizationId ? headerOrganizationId : devSwitcherOrganizationId;
}
