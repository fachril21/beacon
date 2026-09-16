import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getS3Client } from "@/lib/s3/client";
import { getS3Bucket, getS3MaxUploadBytes } from "@/lib/s3/env";
import { buildScreenshotObjectKey, createPresignedUpload } from "@/lib/s3/presign";

interface PresignRequestBody {
  pageId?: string;
  fileName?: string;
  contentType?: string;
  fileSize?: number;
}

/**
 * Issues a presigned S3-compatible PUT URL for a screenshot upload (PRD.md
 * §5.2, Flow 3 step 4). Never touches file bytes or long-lived credentials —
 * the browser PUTs the file directly to the URL returned here.
 */
export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as PresignRequestBody;
  const { pageId, fileName, contentType, fileSize } = body;

  if (!pageId || !fileName || !contentType || typeof fileSize !== "number") {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "INVALID_FILE_TYPE" }, { status: 400 });
  }

  // Machine-readable codes, not prose — the browser maps them to
  // Bahasa Indonesia copy (src/lib/s3/upload-error.ts), same convention as
  // the Organization/Space invite routes.
  const maxUploadBytes = getS3MaxUploadBytes();
  if (fileSize > maxUploadBytes) {
    return NextResponse.json({ error: "FILE_TOO_LARGE", maxUploadBytes }, { status: 413 });
  }

  const key = buildScreenshotObjectKey(pageId, fileName);
  const upload = await createPresignedUpload({
    client: getS3Client(),
    bucket: getS3Bucket(),
    key,
    contentType,
  });

  return NextResponse.json(upload);
}
