"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseSchema, getSupabaseUrl } from "./env";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Singleton Supabase client for Client Components — safe to call from any hook.
 *
 * flowType is declared "implicit" for documentation, but note @supabase/ssr's
 * createBrowserClient hardcodes `flowType: "pkce"` AFTER spreading our options,
 * so the runtime client is always PKCE no matter what we pass. PKCE's
 * detectSessionInUrl only looks for `?code=`, yet admin-generated invite and
 * recovery emails (inviteUserByEmail / resetPasswordForEmail) redirect with the
 * session in the URL's `#access_token=...` fragment, implicit-style — so without
 * the bridge below, the client never consumes them and the invitee is stuck
 * signed-out on the accept-invite page.
 */
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      db: { schema: getSupabaseSchema() },
      auth: { flowType: "implicit" },
    });
    consumeImplicitSessionFragment(browserClient);
  }
  return browserClient;
}

/**
 * Bridges the implicit-style fragment GoTrue puts on invite/recovery email
 * links: feeds the tokens to setSession (which validates via the refresh
 * token, persists the session to cookies, and fires SIGNED_IN for
 * SessionProvider), then strips the tokens from the address bar so they
 * don't linger in history. Runs once, right after client creation — the
 * fragment only exists on the page load that the email link opened.
 */
function consumeImplicitSessionFragment(client: ReturnType<typeof createBrowserClient>) {
  if (typeof window === "undefined" || !window.location.hash.includes("access_token")) return;
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  if (!accessToken || !refreshToken) return;
  void client.auth
    .setSession({ access_token: accessToken, refresh_token: refreshToken })
    .finally(() => {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    });
}
