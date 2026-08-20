/** S3-compatible object storage env vars — same code path for any provider (Backblaze B2, AWS S3, ...), per PRD.md NFR "Dev environment parity". */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Unset for AWS S3 (uses the SDK's regional default endpoint); set to the provider's endpoint otherwise (e.g. Backblaze B2). */
export function getS3Endpoint(): string | undefined {
  return process.env.S3_ENDPOINT || undefined;
}

export function getS3Region(): string {
  return process.env.S3_REGION || "us-east-1";
}

export function getS3Bucket(): string {
  return requireEnv("S3_BUCKET");
}

export function getS3AccessKeyId(): string {
  return requireEnv("S3_ACCESS_KEY_ID");
}

export function getS3SecretAccessKey(): string {
  return requireEnv("S3_SECRET_ACCESS_KEY");
}

/** Required for providers using path-style buckets (e.g. MinIO); AWS S3 and Backblaze B2 should leave this unset. */
export function getS3ForcePathStyle(): boolean {
  return process.env.S3_FORCE_PATH_STYLE === "true";
}

/** Per-upload cap enforced server-side (Epic 12 AC) — defaults to 10MB. */
export function getS3MaxUploadBytes(): number {
  const raw = process.env.S3_MAX_UPLOAD_BYTES;
  return raw ? Number(raw) : 10 * 1024 * 1024;
}
