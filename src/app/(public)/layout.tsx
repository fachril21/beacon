import { headers } from "next/headers";
import { PublicOrgHeaderContext } from "@/hooks/public-org-header-context";
import { PublicLayoutClient } from "./public-layout-client";

/**
 * Server Component boundary so the public site can read the real
 * `x-beacon-organization-id` header set by proxy.ts (Epic 14a) — a plain
 * Client Component can't access request headers directly. The value is
 * handed to usePublicOrgContext (via PublicOrgHeaderContext) which prefers
 * it over the dev-only localStorage switcher.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const organizationId = headerList.get("x-beacon-organization-id");

  return (
    <PublicOrgHeaderContext.Provider value={organizationId}>
      <PublicLayoutClient>{children}</PublicLayoutClient>
    </PublicOrgHeaderContext.Provider>
  );
}
