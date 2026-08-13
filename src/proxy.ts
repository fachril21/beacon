import { NextResponse, type NextRequest } from "next/server";
import { isAppHost, resolveOrganizationForHost } from "@/lib/organization-resolution";
import type { Organization } from "@/lib/types";

/**
 * PRD.md Epic 14a / PROJECT.md §9.3: resolves the request's Host header to
 * an Organization and scopes the public site to it. Deliberately scoped to
 * `/public/*` only (see the matcher below) — workspace/auth/API routes are
 * never touched by this, so a misconfigured or unreachable Organization
 * lookup can't break the authoring app itself.
 *
 * Live-verification status: this queries the real `organizations` table and
 * gates on `is_domain_verified`, so it is not a mock — but it has not been
 * exercised against a real custom domain / Vercel deployment in this
 * session (no Vercel account was available; see the Stage 2 evidence
 * report). The public site's own pages still read Organization context from
 * the dev-only switcher (use-public-org.ts) rather than the
 * `x-beacon-organization-id` header this sets — wiring that swap is the
 * next step once a real verified domain exists to test against.
 */
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const appHosts = (process.env.NEXT_PUBLIC_APP_HOSTS ?? "localhost,127.0.0.1").split(",");

  if (isAppHost(host, appHosts)) {
    return NextResponse.next();
  }

  const organization = await lookupOrganizationForHost(host);
  if (!organization) {
    return new NextResponse("This domain is not configured for Beacon.", { status: 404 });
  }

  const headers = new Headers(request.headers);
  headers.set("x-beacon-organization-id", organization.id);
  return NextResponse.next({ request: { headers } });
}

async function lookupOrganizationForHost(host: string): Promise<Organization | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  const res = await fetch(`${supabaseUrl}/rest/v1/organizations?select=*`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (!res.ok) return null;

  const rows = (await res.json()) as Array<Record<string, unknown>>;
  const organizations: Organization[] = rows.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    domain: row.domain as string | null,
    isDomainVerified: row.is_domain_verified as boolean,
    pendingDnsToken: row.pending_dns_token as string | null,
    createdAt: row.created_at as string,
  }));

  return resolveOrganizationForHost(host, organizations);
}

export const config = {
  matcher: "/public/:path*",
};
