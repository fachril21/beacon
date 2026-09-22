/**
 * Central place that reads and validates the Supabase/S3 env vars Stage 2
 * needs. Throws early (module load / first client construction) rather than
 * failing deep inside a query, per common/security.md "validate required
 * secrets are present at startup."
 */

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function getSupabaseAnonKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabaseServiceRoleKey(): string {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Postgres schema every Supabase client queries against (e.g. "beacon") — see supabase/migrations for the schema-rename migration. */
export function getSupabaseSchema(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_SCHEMA", process.env.NEXT_PUBLIC_SUPABASE_SCHEMA);
}

/** Beacon's Supabase project is shared with Kerjain, so recovery emails must land on Kerjain's reset-password page, not Beacon's own. */
export function getKerjainResetPasswordUrl(): string {
  return requireEnv("NEXT_PUBLIC_KERJAIN_RESET_PASSWORD_URL", process.env.NEXT_PUBLIC_KERJAIN_RESET_PASSWORD_URL);
}
