/**
 * Object storage env vars for the screenshot upload flow (PROJECT.md §9.3 /
 * PRD.md Epic 12). Production is real AWS S3 with virtual-hosted-style URLs;
 * the same code path also serves any S3-compatible emulator (e.g. MinIO) by
 * changing only these vars, per PRD.md NFR "Dev environment parity".
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Unset for AWS S3 (the SDK derives the regional endpoint); may be set explicitly to https://s3.<region>.amazonaws.com or to an emulator's endpoint. */
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

/** Leave unset/false for real AWS S3 (virtual-hosted-style); set true only for a path-style emulator such as MinIO. */
export function getS3ForcePathStyle(): boolean {
  return process.env.S3_FORCE_PATH_STYLE === "true";
}

/** Per-upload cap enforced server-side (Epic 12 AC) — defaults to 10MB. */
export function getS3MaxUploadBytes(): number {
  const raw = process.env.S3_MAX_UPLOAD_BYTES;
  return raw ? Number(raw) : 10 * 1024 * 1024;
}
