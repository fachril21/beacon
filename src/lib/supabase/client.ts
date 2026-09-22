"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseSchema, getSupabaseUrl } from "./env";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Singleton Supabase client for Client Components — safe to call from any hook.
 *
 * flowType is "implicit", not the SDK default "pkce": PKCE's code_verifier
 * lives in the requesting origin's localStorage, but password-recovery
 * links redirect to Kerjain's origin (see use-session.tsx), which has no
 * access to Beacon's localStorage. Implicit flow puts the session tokens
 * directly in the redirect URL's hash fragment instead, so Kerjain can
 * establish the session without needing anything Beacon stored locally.
 */
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      db: { schema: getSupabaseSchema() },
      auth: { flowType: "implicit" },
    });
  }
  return browserClient;
}
