import { NextResponse } from "next/server";
import { getS3Client } from "@/lib/s3/client";
import { getS3Bucket } from "@/lib/s3/env";
import { buildDocObjectKey, InvalidDocPathError } from "@/lib/s3/doc-key";
import { getDocObject, ObjectNotFoundError } from "@/lib/s3/get-object";

/**
 * Public, unauthenticated documentation-file proxy. Streams a docs/ object
 * from the (intentionally private) storage bucket so the bucket itself is
 * never exposed as a direct URL — this route is the only way in.
 */
export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await params;

  let objectKey: string;
  try {
    objectKey = buildDocObjectKey(segments);
  } catch (error) {
    if (error instanceof InvalidDocPathError) {
      return NextResponse.json({ error: "Invalid document path" }, { status: 400 });
    }
    throw error;
  }

  const ifModifiedSinceHeader = request.headers.get("if-modified-since");

  let result;
  try {
    result = await getDocObject({
      client: getS3Client(),
      bucket: getS3Bucket(),
      key: objectKey,
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
      ifModifiedSince: ifModifiedSinceHeader ? new Date(ifModifiedSinceHeader) : undefined,
    });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    throw error;
  }

  if ("notModified" in result) {
    return new Response(null, { status: 304 });
  }

  const isDownload = new URL(request.url).searchParams.has("download");
  const fileName = segments[segments.length - 1];

  const headers = new Headers({
    "Content-Type": result.contentType,
    "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=3600",
    "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${fileName}"`,
  });
  if (result.etag) headers.set("ETag", result.etag);
  if (result.lastModified) headers.set("Last-Modified", result.lastModified.toUTCString());

  return new Response(result.stream, { status: 200, headers });
}
