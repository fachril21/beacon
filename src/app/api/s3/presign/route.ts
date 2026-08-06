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
 * Issues a presigned S3/MinIO POST for a screenshot upload (PRD.md §5.2,
 * Flow 3 step 4). Never touches file bytes or long-lived credentials — the
 * browser uploads directly to S3/MinIO with the fields returned here.
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
    return NextResponse.json({ error: "pageId, fileName, contentType, and fileSize are required" }, { status: 400 });
  }
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are allowed" }, { status: 400 });
  }

  const maxUploadBytes = getS3MaxUploadBytes();
  if (fileSize > maxUploadBytes) {
    return NextResponse.json(
      { error: `File exceeds the ${maxUploadBytes}-byte upload limit` },
      { status: 413 },
    );
  }

  const key = buildScreenshotObjectKey(pageId, fileName);
  const upload = await createPresignedUpload({
    client: getS3Client(),
    bucket: getS3Bucket(),
    key,
    contentType,
    maxUploadBytes,
  });

  return NextResponse.json(upload);
}
