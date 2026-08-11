const UNITS: { limit: number; divisor: number; unit: string }[] = [
  { limit: 60, divisor: 1, unit: "detik" },
  { limit: 3600, divisor: 60, unit: "menit" },
  { limit: 86400, divisor: 3600, unit: "jam" },
  { limit: 2592000, divisor: 86400, unit: "hari" },
  { limit: 31536000, divisor: 2592000, unit: "bulan" },
];

/** Bahasa Indonesia relative timestamp (e.g. "5 menit lalu") — matches PRODUCT.md's Bahasa-only UI requirement. No date-fns dependency for one string. */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 30) return "Baru saja";
  for (const { limit, divisor, unit } of UNITS) {
    if (seconds < limit) return `${Math.floor(seconds / divisor)} ${unit} lalu`;
  }
  return `${Math.floor(seconds / 31536000)} tahun lalu`;
}
