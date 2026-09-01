import { describe, it, expect, afterEach } from "vitest";
import { getS3Endpoint, getS3Region, getS3Bucket, getS3ForcePathStyle, getS3MaxUploadBytes } from "./env";

/**
 * The screenshot upload targets real AWS S3 (virtual-hosted-style URLs), so
 * the AWS-shaped defaults matter: no explicit endpoint, path-style off, and
 * a sane server-side upload cap when the var is unset.
 */
describe("s3 env helpers", () => {
  const snapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...snapshot };
  });

  describe("getS3Endpoint", () => {
    it("is undefined when S3_ENDPOINT is unset (AWS SDK uses its regional default)", () => {
      delete process.env.S3_ENDPOINT;
      expect(getS3Endpoint()).toBeUndefined();
    });

    it("passes an explicit regional endpoint through unchanged", () => {
      process.env.S3_ENDPOINT = "https://s3.ap-southeast-1.amazonaws.com";
      expect(getS3Endpoint()).toBe("https://s3.ap-southeast-1.amazonaws.com");
    });
  });

  describe("getS3Region", () => {
    it("defaults to us-east-1 when unset", () => {
      delete process.env.S3_REGION;
      expect(getS3Region()).toBe("us-east-1");
    });
  });

  describe("getS3Bucket", () => {
    it("throws a named error when S3_BUCKET is missing", () => {
      delete process.env.S3_BUCKET;
      expect(() => getS3Bucket()).toThrow(/S3_BUCKET/);
    });
  });

  describe("getS3ForcePathStyle", () => {
    it("is false unless S3_FORCE_PATH_STYLE is exactly \"true\" (AWS uses virtual-hosted-style)", () => {
      delete process.env.S3_FORCE_PATH_STYLE;
      expect(getS3ForcePathStyle()).toBe(false);

      process.env.S3_FORCE_PATH_STYLE = "false";
      expect(getS3ForcePathStyle()).toBe(false);

      process.env.S3_FORCE_PATH_STYLE = "true";
      expect(getS3ForcePathStyle()).toBe(true);
    });
  });

  describe("getS3MaxUploadBytes", () => {
    it("defaults to 10 MiB when S3_MAX_UPLOAD_BYTES is unset", () => {
      delete process.env.S3_MAX_UPLOAD_BYTES;
      expect(getS3MaxUploadBytes()).toBe(10 * 1024 * 1024);
    });

    it("honours a numeric override", () => {
      process.env.S3_MAX_UPLOAD_BYTES = "5242880";
      expect(getS3MaxUploadBytes()).toBe(5242880);
    });
  });
});
