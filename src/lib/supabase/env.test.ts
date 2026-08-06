import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceRoleKey } from "./env";

describe("supabase env validation", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it("throws a descriptive error when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => getSupabaseUrl()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("returns the configured URL when present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    expect(getSupabaseUrl()).toBe("https://example.supabase.co");
  });

  it("throws when the anon key is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => getSupabaseAnonKey()).toThrowError(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("throws when the service role key is missing", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getSupabaseServiceRoleKey()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
