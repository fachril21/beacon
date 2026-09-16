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

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://s3.example.com/bucket/screenshots/page-1/abc.png?X-Amz-Signature=fake"),
}));
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  return { ...actual };
});

const { createPresignedUpload } = await import("./presign");
const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
const { PutObjectCommand } = await import("@aws-sdk/client-s3");

describe("createPresignedUpload", () => {
  it("requests a presigned PUT scoped to the bucket/key/content-type", async () => {
    const fakeClient = {} as never;
    const result = await createPresignedUpload({
      client: fakeClient,
      bucket: "beacon-screenshots",
      key: "screenshots/page-1/abc.png",
      contentType: "image/png",
    });

    expect(getSignedUrl).toHaveBeenCalledWith(
      fakeClient,
      expect.any(PutObjectCommand),
      expect.objectContaining({ expiresIn: 60 }),
    );
    const [, command] = vi.mocked(getSignedUrl).mock.calls[0];
    expect(command.input).toEqual(
      expect.objectContaining({
        Bucket: "beacon-screenshots",
        Key: "screenshots/page-1/abc.png",
        ContentType: "image/png",
      }),
    );
    expect(result).toEqual({
      url: "https://s3.example.com/bucket/screenshots/page-1/abc.png?X-Amz-Signature=fake",
      objectKey: "screenshots/page-1/abc.png",
    });
  });
});
