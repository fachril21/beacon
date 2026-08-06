import "server-only";
import type { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

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
  fields: Record<string, string>;
  objectKey: string;
}

export interface CreatePresignedUploadInput {
  client: S3Client;
  bucket: string;
  key: string;
  contentType: string;
  maxUploadBytes: number;
}

/**
 * A presigned POST (not a presigned PUT) so the size cap is enforced by S3
 * itself via a `content-length-range` policy condition, not merely trusted
 * client-side — a PUT presigned URL alone cannot reject an oversized body.
 */
export async function createPresignedUpload(input: CreatePresignedUploadInput): Promise<PresignedUpload> {
  const { url, fields } = await createPresignedPost(input.client, {
    Bucket: input.bucket,
    Key: input.key,
    Conditions: [
      ["content-length-range", 0, input.maxUploadBytes],
      ["eq", "$Content-Type", input.contentType],
    ],
    Fields: {
      "Content-Type": input.contentType,
    },
    Expires: 60,
  });

  return { url, fields, objectKey: input.key };
}
