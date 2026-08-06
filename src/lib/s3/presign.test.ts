import { describe, it, expect, vi } from "vitest";
import { buildScreenshotObjectKey } from "./presign";

describe("buildScreenshotObjectKey", () => {
  it("namespaces the key by pageId and keeps the file extension", () => {
    const key = buildScreenshotObjectKey("page-1", "My Screenshot.PNG");
    expect(key).toMatch(/^screenshots\/page-1\/[a-z0-9-]+\.png$/);
  });

  it("defaults to .bin when the file name has no recognizable extension", () => {
    const key = buildScreenshotObjectKey("page-1", "screenshot");
    expect(key).toMatch(/^screenshots\/page-1\/[a-z0-9-]+\.bin$/);
  });

  it("produces a different key on every call (no accidental overwrite of a prior upload)", () => {
    const a = buildScreenshotObjectKey("page-1", "shot.png");
    const b = buildScreenshotObjectKey("page-1", "shot.png");
    expect(a).not.toBe(b);
  });

  it("strips path separators and unsafe characters from the file name component", () => {
    const key = buildScreenshotObjectKey("page-1", "../../etc/passwd.png");
    expect(key).not.toContain("..");
    expect(key).not.toContain("/etc/");
  });
});

vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: vi.fn(async () => ({
    url: "https://s3.example.com/bucket",
    fields: { key: "screenshots/page-1/abc.png", policy: "fake-policy", "x-amz-signature": "fake-sig" },
  })),
}));

const { createPresignedUpload } = await import("./presign");
const { createPresignedPost } = await import("@aws-sdk/s3-presigned-post");

describe("createPresignedUpload", () => {
  it("requests a presigned POST scoped to the bucket/key/content-type with a size-cap condition", async () => {
    const fakeClient = {} as never;
    const result = await createPresignedUpload({
      client: fakeClient,
      bucket: "beacon-screenshots",
      key: "screenshots/page-1/abc.png",
      contentType: "image/png",
      maxUploadBytes: 10_485_760,
    });

    expect(createPresignedPost).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({
        Bucket: "beacon-screenshots",
        Key: "screenshots/page-1/abc.png",
        Conditions: expect.arrayContaining([
          ["content-length-range", 0, 10_485_760],
          ["eq", "$Content-Type", "image/png"],
        ]),
      }),
    );
    expect(result).toEqual({
      url: "https://s3.example.com/bucket",
      fields: { key: "screenshots/page-1/abc.png", policy: "fake-policy", "x-amz-signature": "fake-sig" },
      objectKey: "screenshots/page-1/abc.png",
    });
  });
});
