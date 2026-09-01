import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseSchema, getSupabaseUrl } from "./env";

/**
 * Supabase client for Server Components / Route Handlers — carries the
 * caller's cookie-based session so RLS policies evaluate as that user
 * (never the service role). Must be constructed per-request, not cached.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    db: { schema: getSupabaseSchema() },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render (not a Route Handler/Action) —
          // middleware refreshes the session cookie instead, so this is safe to ignore.
        }
      },
    },
  });
}
