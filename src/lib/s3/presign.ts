import "server-only";
import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * `screenshots/<pageId>/<random>.<ext>` — namespaced by Page so cleanup and
 * per-page listing are trivial, randomized so concurrent uploads (or a
 * retried upload) never collide or overwrite each other.
 */
export function buildScreenshotObjectKey(pageId: string, fileName: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(fileName);
  const ext = (match?.[1] ?? "bin").toLowerCase();
  const randomId = crypto.randomUUID();
  return `screenshots/${pageId}/${randomId}.${ext}`;
}

export interface PresignedUpload {
  url: string;
  objectKey: string;
}

export interface CreatePresignedUploadInput {
  client: S3Client;
  bucket: string;
  key: string;
  contentType: string;
}

/**
 * A presigned PUT, not a presigned POST — Backblaze B2's S3-compatible API
 * does not support browser-based POST uploads. The upload size cap is
 * therefore only checked pre-flight in the presign route, not enforced by
 * the storage layer itself (a POST policy's content-length-range condition
 * has no PUT equivalent).
 */
export async function createPresignedUpload(input: CreatePresignedUploadInput): Promise<PresignedUpload> {
  const command = new PutObjectCommand({
    Bucket: input.bucket,
    Key: input.key,
    ContentType: input.contentType,
  });
  const url = await getSignedUrl(input.client, command, { expiresIn: 60 });

  return { url, objectKey: input.key };
}
