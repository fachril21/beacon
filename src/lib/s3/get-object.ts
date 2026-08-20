import "server-only";
import { Readable } from "node:stream";
import { GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";

export class ObjectNotFoundError extends Error {}

export interface GetDocObjectInput {
  client: S3Client;
  bucket: string;
  key: string;
  ifNoneMatch?: string;
  ifModifiedSince?: Date;
}

export interface GetDocObjectResult {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  etag: string | undefined;
  lastModified: Date | undefined;
}

export type GetDocObjectOutput = GetDocObjectResult | { notModified: true };

interface S3LikeError {
  name?: string;
  $metadata?: { httpStatusCode?: number };
}

function isNotModified(error: unknown): boolean {
  return (error as S3LikeError).$metadata?.httpStatusCode === 304;
}

function isNoSuchKey(error: unknown): boolean {
  const e = error as S3LikeError;
  return e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404;
}

/**
 * Fetches a docs/ object for the public proxy route (src/app/api/docs). B2
 * has no PUT-equivalent size-range enforcement, but reads are plain
 * GetObject, so conditional-GET (If-None-Match/If-Modified-Since) works the
 * same as any S3-compatible provider — the route relies on it for 304s.
 */
export async function getDocObject(input: GetDocObjectInput): Promise<GetDocObjectOutput> {
  try {
    const response = await input.client.send(
      new GetObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        IfNoneMatch: input.ifNoneMatch,
        IfModifiedSince: input.ifModifiedSince,
      }),
    );

    if (!response.Body) {
      throw new ObjectNotFoundError(input.key);
    }

    return {
      stream: Readable.toWeb(response.Body as Readable) as ReadableStream<Uint8Array>,
      contentType: response.ContentType ?? "application/octet-stream",
      etag: response.ETag,
      lastModified: response.LastModified,
    };
  } catch (error) {
    if (isNotModified(error)) {
      return { notModified: true };
    }
    if (isNoSuchKey(error)) {
      throw new ObjectNotFoundError(input.key);
    }
    throw error;
  }
}
