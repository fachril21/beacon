import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/s3/client", () => ({ getS3Client: () => ({}) }));
vi.mock("@/lib/s3/env", () => ({ getS3Bucket: () => "beacon-storage" }));

const mockGetDocObject = vi.fn();
vi.mock("@/lib/s3/get-object", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/s3/get-object")>();
  return { ...actual, getDocObject: mockGetDocObject };
});

const { GET } = await import("./route");

function makeRequest(path: string, headers?: Record<string, string>) {
  return new Request(`http://localhost/api/docs/${path}`, { headers });
}

function webStreamOf(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

async function readBody(response: Response): Promise<string> {
  return new Response(response.body).text();
}

describe("GET /api/docs/[...key]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("streams the object with the content-type, ETag, and inline disposition", async () => {
    mockGetDocObject.mockResolvedValue({
      stream: webStreamOf("%PDF-1.4 fake"),
      contentType: "application/pdf",
      etag: '"abc123"',
      lastModified: new Date("2026-01-01T00:00:00Z"),
    });

    const response = await GET(makeRequest("handbook/intro.pdf"), { params: Promise.resolve({ key: ["handbook", "intro.pdf"] }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("ETag")).toBe('"abc123"');
    expect(response.headers.get("Content-Disposition")).toBe('inline; filename="intro.pdf"');
    expect(response.headers.get("Cache-Control")).toContain("public");
    expect(await readBody(response)).toBe("%PDF-1.4 fake");
    expect(mockGetDocObject).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: "beacon-storage", key: "docs/handbook/intro.pdf" }),
    );
  });

  it("sets Content-Disposition: attachment when ?download is present", async () => {
    mockGetDocObject.mockResolvedValue({
      stream: webStreamOf("data"),
      contentType: "image/png",
      etag: undefined,
      lastModified: undefined,
    });

    const response = await GET(new Request("http://localhost/api/docs/shot.png?download"), {
      params: Promise.resolve({ key: ["shot.png"] }),
    });

    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="shot.png"');
  });

  it("forwards If-None-Match and returns 304 without a body when B2 says not modified", async () => {
    mockGetDocObject.mockResolvedValue({ notModified: true });

    const response = await GET(makeRequest("handbook/intro.pdf", { "if-none-match": '"abc123"' }), {
      params: Promise.resolve({ key: ["handbook", "intro.pdf"] }),
    });

    expect(response.status).toBe(304);
    expect(mockGetDocObject).toHaveBeenCalledWith(expect.objectContaining({ ifNoneMatch: '"abc123"' }));
  });

  it("returns 404 when the document doesn't exist", async () => {
    const { ObjectNotFoundError } = await import("@/lib/s3/get-object");
    mockGetDocObject.mockRejectedValue(new ObjectNotFoundError("docs/missing.pdf"));

    const response = await GET(makeRequest("missing.pdf"), { params: Promise.resolve({ key: ["missing.pdf"] }) });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Document not found" });
  });

  it("returns 400 for a path-traversal attempt without ever calling S3", async () => {
    const response = await GET(makeRequest("..%2Fetc%2Fpasswd.pdf"), {
      params: Promise.resolve({ key: ["..", "etc", "passwd.pdf"] }),
    });

    expect(response.status).toBe(400);
    expect(mockGetDocObject).not.toHaveBeenCalled();
  });

  it("returns 400 for a disallowed file extension", async () => {
    const response = await GET(makeRequest("malware.exe"), { params: Promise.resolve({ key: ["malware.exe"] }) });

    expect(response.status).toBe(400);
    expect(mockGetDocObject).not.toHaveBeenCalled();
  });
});
