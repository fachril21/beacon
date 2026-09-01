"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseSchema, getSupabaseUrl } from "./env";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/** Singleton Supabase client for Client Components — safe to call from any hook. */
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      db: { schema: getSupabaseSchema() },
    });
  }
  return browserClient;
}
