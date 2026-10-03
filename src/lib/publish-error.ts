const UNKNOWN_ERROR = "Terjadi kesalahan tak terduga.";

/** Postgres/PostgREST codes that mean "the database is missing a migration". */
const MISSING_MIGRATION_CODES = new Set(["PGRST202", "42703", "42883", "42P01"]);

function readCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error as { code: unknown };
    return typeof code === "string" ? code : null;
  }
  return null;
}

/**
 * A user-facing (Indonesian) reason for a failed publish/update/unpublish
 * call — the toast headline stays generic, this is its description. The raw
 * error is still logged by the caller for debugging.
 */
export function describePublishError(error: unknown): string {
  const code = readCode(error);
  if (code === "42501") return "Anda tidak memiliki izin untuk memublikasikan halaman ini.";
  if (code === "23505") return "Slug halaman bentrok dengan halaman lain di organisasi ini.";
  if (code && MISSING_MIGRATION_CODES.has(code)) {
    return "Database belum diperbarui (migrasi belum dijalankan). Hubungi admin.";
  }
  if (error instanceof TypeError) return "Periksa koneksi internet Anda lalu coba lagi.";
  return UNKNOWN_ERROR;
}
