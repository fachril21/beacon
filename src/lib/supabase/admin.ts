import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseSchema, getSupabaseServiceRoleKey, getSupabaseUrl } from "./env";

/**
 * Service-role Supabase client — bypasses RLS entirely. Only for server-only
 * privileged operations that must run outside the caller's own permissions
 * (e.g. the atomic publish RPC, anonymous feedback rate limiting). Never
 * import this from a Client Component or expose its key to the browser.
 */
export function getSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    db: { schema: getSupabaseSchema() },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
