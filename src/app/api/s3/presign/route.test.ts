import { describe, it, expect, vi, beforeEach } from "vitest";

const mockServerClient = { auth: { getUser: vi.fn() } };
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => Promise.resolve(mockServerClient),
}));

vi.mock("@/lib/s3/client", () => ({ getS3Client: () => ({}) }));

const mockEnv = {
  getS3Bucket: vi.fn(() => "beacon-screenshots"),
  getS3MaxUploadBytes: vi.fn(() => 10 * 1024 * 1024),
};
vi.mock("@/lib/s3/env", () => mockEnv);

const mockPresign = {
  buildScreenshotObjectKey: vi.fn(() => "screenshots/page-1/abc.png"),
  createPresignedUpload: vi.fn(async () => ({
    url: "https://beacon-screenshots.s3.ap-southeast-1.amazonaws.com/screenshots/page-1/abc.png?X-Amz-Signature=fake",
    objectKey: "screenshots/page-1/abc.png",
  })),
};
vi.mock("@/lib/s3/presign", () => mockPresign);

const { POST } = await import("./route");

const validBody = { pageId: "page-1", fileName: "shot.png", contentType: "image/png", fileSize: 1234 };

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/s3/presign", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/s3/presign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServerClient.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockEnv.getS3Bucket.mockReturnValue("beacon-screenshots");
    mockEnv.getS3MaxUploadBytes.mockReturnValue(10 * 1024 * 1024);
    mockPresign.buildScreenshotObjectKey.mockReturnValue("screenshots/page-1/abc.png");
    mockPresign.createPresignedUpload.mockResolvedValue({
      url: "https://beacon-screenshots.s3.ap-southeast-1.amazonaws.com/screenshots/page-1/abc.png?X-Amz-Signature=fake",
      objectKey: "screenshots/page-1/abc.png",
    });
  });

  it("returns 401 when there is no authenticated user, without issuing a URL", async () => {
    mockServerClient.auth.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    expect(mockPresign.createPresignedUpload).not.toHaveBeenCalled();
  });

  it("returns 400 MISSING_FIELDS when a required field is absent", async () => {
    const res = await POST(makeRequest({ pageId: "page-1" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "MISSING_FIELDS" });
  });

  it("returns 400 INVALID_FILE_TYPE for a non-image content type", async () => {
    const res = await POST(makeRequest({ ...validBody, contentType: "application/pdf" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_FILE_TYPE" });
  });

  it("returns 413 FILE_TOO_LARGE with the limit when the file exceeds S3_MAX_UPLOAD_BYTES, without issuing a URL", async () => {
    mockEnv.getS3MaxUploadBytes.mockReturnValue(1000);
    const res = await POST(makeRequest({ ...validBody, fileSize: 5000 }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "FILE_TOO_LARGE", maxUploadBytes: 1000 });
    expect(mockPresign.createPresignedUpload).not.toHaveBeenCalled();
  });

  it("issues a presigned PUT scoped to the built object key and returns { url, objectKey }", async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(mockPresign.buildScreenshotObjectKey).toHaveBeenCalledWith("page-1", "shot.png");
    expect(mockPresign.createPresignedUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "beacon-screenshots",
        key: "screenshots/page-1/abc.png",
        contentType: "image/png",
      }),
    );
    expect(await res.json()).toEqual({
      url: "https://beacon-screenshots.s3.ap-southeast-1.amazonaws.com/screenshots/page-1/abc.png?X-Amz-Signature=fake",
      objectKey: "screenshots/page-1/abc.png",
    });
  });
});
