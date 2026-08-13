import type { Organization } from "@/lib/types";

/**
 * Two Organizations per PROJECT.md §5.5 — Dibimbing (verified domain, so
 * publishing is fully unblocked) and Cakrawala University (no domain yet, so
 * Epic 6/8a's "Organization needs a verified domain" state is reachable).
 */
export const mockOrganizations: Organization[] = [
  {
    id: "org-dibimbing",
    name: "Dibimbing",
    slug: "dibimbing",
    domain: "docs.dibimbing.id",
    isDomainVerified: true,
    pendingDnsToken: null,
    createdAt: "2025-11-03T02:00:00.000Z",
  },
  {
    id: "org-cakrawala",
    name: "Cakrawala University",
    slug: "cakrawala-university",
    domain: null,
    isDomainVerified: false,
    pendingDnsToken: null,
    createdAt: "2026-01-12T04:30:00.000Z",
  },
];
