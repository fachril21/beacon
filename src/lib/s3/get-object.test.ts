import { describe, it, expect, vi } from "vitest";
import { Readable } from "node:stream";
import { getDocObject, ObjectNotFoundError } from "./get-object";

function fakeBodyStream(text: string) {
  return Readable.from([Buffer.from(text)]);
}

describe("getDocObject", () => {
  it("returns a web ReadableStream plus content-type/etag/last-modified metadata", async () => {
    const send = vi.fn(async () => ({
      Body: fakeBodyStream("hello world"),
      ContentType: "application/pdf",
      ETag: '"abc123"',
      LastModified: new Date("2026-01-01T00:00:00Z"),
    }));
    const client = { send } as never;

    const result = await getDocObject({ client, bucket: "beacon-storage", key: "docs/handbook/intro.pdf" });

    expect("notModified" in result).toBe(false);
    if ("notModified" in result) return;
    expect(result.contentType).toBe("application/pdf");
    expect(result.etag).toBe('"abc123"');
    expect(result.lastModified).toEqual(new Date("2026-01-01T00:00:00Z"));

    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    expect(Buffer.concat(chunks).toString()).toBe("hello world");
  });

  it("defaults content-type to application/octet-stream when B2 doesn't return one", async () => {
    const send = vi.fn(async () => ({ Body: fakeBodyStream("x"), ETag: '"e"' }));
    const client = { send } as never;

    const result = await getDocObject({ client, bucket: "beacon-storage", key: "docs/x.pdf" });

    expect("notModified" in result).toBe(false);
    if ("notModified" in result) return;
    expect(result.contentType).toBe("application/octet-stream");
  });

  it("returns { notModified: true } when B2 responds 304 to a conditional GET", async () => {
    const send = vi.fn(async () => {
      const error = new Error("Not Modified") as Error & { $metadata: { httpStatusCode: number } };
      error.$metadata = { httpStatusCode: 304 };
      throw error;
    });
    const client = { send } as never;

    const result = await getDocObject({
      client,
      bucket: "beacon-storage",
      key: "docs/x.pdf",
      ifNoneMatch: '"abc123"',
    });

    expect(result).toEqual({ notModified: true });
  });

  it("throws ObjectNotFoundError when the key doesn't exist", async () => {
    const send = vi.fn(async () => {
      const error = new Error("The specified key does not exist.") as Error & { name: string };
      error.name = "NoSuchKey";
      throw error;
    });
    const client = { send } as never;

    await expect(getDocObject({ client, bucket: "beacon-storage", key: "docs/missing.pdf" })).rejects.toThrow(
      ObjectNotFoundError,
    );
  });

  it("re-throws unrelated S3 errors instead of swallowing them", async () => {
    const send = vi.fn(async () => {
      throw new Error("network exploded");
    });
    const client = { send } as never;

    await expect(getDocObject({ client, bucket: "beacon-storage", key: "docs/x.pdf" })).rejects.toThrow(
      "network exploded",
    );
  });
});
