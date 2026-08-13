"use client";

import { createContext } from "react";

/**
 * Populated by the (public) Server Component layout from the real
 * `x-beacon-organization-id` request header (src/proxy.ts) — non-null only
 * on a request that arrived on a verified custom domain. Null on the app's
 * own host (localhost / Vercel preview), where usePublicOrgContext falls
 * back to the existing dev-only localStorage switcher.
 */
export const PublicOrgHeaderContext = createContext<string | null>(null);
