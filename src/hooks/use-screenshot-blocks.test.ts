import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { screenshotBlocksStore } from "@/lib/supabase/stores";

const mockSupabase = { from: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => mockSupabase }));

const { useScreenshotBlock, useScreenshotBlockLookup, useCreateScreenshotBlock, useUploadScreenshot, useUpdateScreenshotAnnotations, usePatchScreenshotAnnotationsLocal } =
  await import("./use-screenshot-blocks");

function resetStore() {
  screenshotBlocksStore.setState([]);
  screenshotBlocksStore.invalidate("all");
  screenshotBlocksStore.invalidate("page:page-1");
}

describe("useScreenshotBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("loads existing screenshot_blocks rows for the page when the store starts empty, e.g. after a browser reload", async () => {
    const row = {
      id: "shot-1",
      page_id: "page-1",
      order: 0,
      image_object_key: "screenshots/page-1/abc.png",
      image_width: 800,
      image_height: 600,
      description: "",
      alt_text: null,
      created_at: "t",
      updated_at: "t",
    };
    const eq = vi.fn(() => Promise.resolve({ data: [row], error: null }));
    mockSupabase.from.mockReturnValue({ select: () => ({ eq }) });

    const { result } = renderHook(() => useScreenshotBlock("shot-1", "page-1"));

    expect(result.current).toBeUndefined();
    await waitFor(() => expect(result.current).toMatchObject({ id: "shot-1", imageUrl: "screenshots/page-1/abc.png" }));
    expect(mockSupabase.from).toHaveBeenCalledWith("screenshot_blocks");
    expect(eq).toHaveBeenCalledWith("page_id", "page-1");
  });

  it("does not query Supabase when the page id is not yet known", () => {
    const { result } = renderHook(() => useScreenshotBlock("shot-1", undefined));
    expect(result.current).toBeUndefined();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

function blockRow(id: string) {
  return {
    id,
    page_id: "page-1",
    order: 0,
    image_object_key: `screenshots/page-1/${id}.png`,
    image_width: 800,
    image_height: 600,
    description: "",
    alt_text: null,
    created_at: "t",
    updated_at: "t",
  };
}

/** A page query that answers with a different row set on each call, in order. */
function mockPageQueries(...responses: Array<{ data: unknown[] | null; error: Error | null }>) {
  const eq = vi.fn();
  for (const response of responses) eq.mockResolvedValueOnce(response);
  mockSupabase.from.mockReturnValue({ select: () => ({ eq }) });
  return eq;
}

describe("useScreenshotBlockLookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("reports loading, not missing, while the page's blocks are still being fetched", async () => {
    mockPageQueries({ data: [blockRow("shot-1")], error: null });

    const { result } = renderHook(() => useScreenshotBlockLookup("shot-1", "page-1"));

    expect(result.current).toMatchObject({ block: undefined, status: "loading" });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.block).toMatchObject({ id: "shot-1" });
  });

  it("refetches the page when a block uploaded by another member is absent from an already-loaded store", async () => {
    // First page load predates the other member's upload; the second sees it.
    const eq = mockPageQueries(
      { data: [blockRow("shot-1")], error: null },
      { data: [blockRow("shot-1"), blockRow("shot-2")], error: null },
    );

    const first = renderHook(() => useScreenshotBlockLookup("shot-1", "page-1"));
    await waitFor(() => expect(first.result.current.status).toBe("ready"));

    const second = renderHook(() => useScreenshotBlockLookup("shot-2", "page-1"));
    await waitFor(() => expect(second.result.current.status).toBe("ready"));

    expect(second.result.current.block).toMatchObject({ id: "shot-2" });
    expect(eq).toHaveBeenCalledTimes(2);
  });

  it("reports missing when the block is still absent after a fresh refetch", async () => {
    mockPageQueries({ data: [], error: null }, { data: [], error: null });

    const { result } = renderHook(() => useScreenshotBlockLookup("ghost", "page-1"));

    await waitFor(() => expect(result.current.status).toBe("missing"));
    expect(result.current.block).toBeUndefined();
  });

  it("reports error, not missing, when the query fails (e.g. RLS or network)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockPageQueries({ data: null, error: new Error("permission denied") });

    const { result } = renderHook(() => useScreenshotBlockLookup("shot-1", "page-1"));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.block).toBeUndefined();
  });

  it("is idle for a block with no id yet, without querying", () => {
    const { result } = renderHook(() => useScreenshotBlockLookup(undefined, "page-1"));
    expect(result.current).toMatchObject({ block: undefined, status: "idle" });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe("useCreateScreenshotBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it("inserts a screenshot_blocks row referencing the S3 object key and patches the store", async () => {
    const row = {
      id: "shot-1",
      page_id: "page-1",
      order: 0,
      image_object_key: "screenshots/page-1/abc.png",
      image_width: 800,
      image_height: 600,
      description: "",
      alt_text: null,
      created_at: "t",
      updated_at: "t",
    };
    mockSupabase.from.mockReturnValue({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: row, error: null }) }) }),
    });

    const { result } = renderHook(() => useCreateScreenshotBlock());
    let created: unknown;
    await act(async () => {
      created = await result.current({
        pageId: "page-1",
        order: 0,
        imageUrl: "screenshots/page-1/abc.png",
        imageWidth: 800,
        imageHeight: 600,
      });
    });

    expect(created).toMatchObject({ id: "shot-1", imageUrl: "screenshots/page-1/abc.png" });
    expect(screenshotBlocksStore.getState()).toEqual([expect.objectContaining({ id: "shot-1" })]);
  });
});

describe("useUploadScreenshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/s3/presign") {
          return {
            ok: true,
            json: async () => ({
              url: "https://s3.example.com/bucket/screenshots/page-1/abc.png?X-Amz-Signature=fake",
              objectKey: "screenshots/page-1/abc.png",
            }),
          };
        }
        // The direct-to-S3 PUT.
        return { ok: true };
      }),
    );
  });

  it("presigns, uploads directly to S3, then creates the screenshot_blocks row with the returned object key", async () => {
    const row = {
      id: "shot-1",
      page_id: "page-1",
      order: 0,
      image_object_key: "screenshots/page-1/abc.png",
      image_width: 800,
      image_height: 600,
      description: "",
      alt_text: null,
      created_at: "t",
      updated_at: "t",
    };
    mockSupabase.from.mockReturnValue({
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: row, error: null }) }) }),
    });

    const file = new File(["fake-bytes"], "shot.png", { type: "image/png" });
    const { result } = renderHook(() => useUploadScreenshot());

    let created: unknown;
    await act(async () => {
      created = await result.current({ pageId: "page-1", order: 0, file, width: 800, height: 600 });
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/s3/presign",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ pageId: "page-1", fileName: "shot.png", contentType: "image/png", fileSize: file.size }),
      }),
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://s3.example.com/bucket/screenshots/page-1/abc.png?X-Amz-Signature=fake",
      expect.objectContaining({ method: "PUT", headers: { "Content-Type": "image/png" }, body: file }),
    );
    expect(created).toMatchObject({ id: "shot-1", imageUrl: "screenshots/page-1/abc.png" });
  });

  it("rejects with the server's error code when the presign route refuses the file (e.g. over the size cap), without creating a DB row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/s3/presign") {
          return { ok: false, status: 413, json: async () => ({ error: "FILE_TOO_LARGE", maxUploadBytes: 1000 }) };
        }
        return { ok: true };
      }),
    );
    const insert = vi.fn();
    mockSupabase.from.mockReturnValue({ insert });

    const file = new File(["fake-bytes"], "huge.png", { type: "image/png" });
    const { result } = renderHook(() => useUploadScreenshot());

    await expect(
      result.current({ pageId: "page-1", order: 0, file, width: 800, height: 600 }),
    ).rejects.toThrow("FILE_TOO_LARGE");
    expect(insert).not.toHaveBeenCalled();
  });

  it("falls back to PRESIGN_FAILED when the presign route errors with an unparseable body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/s3/presign") {
          return {
            ok: false,
            status: 500,
            json: async () => {
              throw new Error("not json");
            },
          };
        }
        return { ok: true };
      }),
    );
    const insert = vi.fn();
    mockSupabase.from.mockReturnValue({ insert });

    const file = new File(["fake-bytes"], "shot.png", { type: "image/png" });
    const { result } = renderHook(() => useUploadScreenshot());

    await expect(
      result.current({ pageId: "page-1", order: 0, file, width: 800, height: 600 }),
    ).rejects.toThrow("PRESIGN_FAILED");
    expect(insert).not.toHaveBeenCalled();
  });

  it("throws when the S3 upload itself fails, without creating a DB row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/s3/presign") {
          return {
            ok: true,
            json: async () => ({ url: "https://s3.example.com/bucket/k", objectKey: "k" }),
          };
        }
        return { ok: false, status: 403 };
      }),
    );
    const insert = vi.fn();
    mockSupabase.from.mockReturnValue({ insert });

    const file = new File(["fake-bytes"], "shot.png", { type: "image/png" });
    const { result } = renderHook(() => useUploadScreenshot());

    await expect(
      result.current({ pageId: "page-1", order: 0, file, width: 800, height: 600 }),
    ).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });
});

function seedBlock() {
  screenshotBlocksStore.setState([
    {
      id: "shot-1",
      pageId: "page-1",
      type: "screenshot",
      order: 0,
      imageUrl: "shot.png",
      imageWidth: 800,
      imageHeight: 600,
      annotations: [],
      description: "",
      altText: null,
      createdAt: "t",
      updatedAt: "t",
    },
  ]);
}

const sampleAnnotations = [{ id: "ann-1", type: "box" as const, order: 1, color: "#ff0000", x: 0.1, y: 0.2, width: 0.3, height: 0.15 }];

describe("useUpdateScreenshotAnnotations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    seedBlock();
  });

  it("writes annotation_json to Supabase for the given block id", async () => {
    const eq = vi.fn(() => Promise.resolve({ error: null }));
    const update = vi.fn(() => ({ eq }));
    mockSupabase.from.mockReturnValue({ update });

    const { result } = renderHook(() => useUpdateScreenshotAnnotations());
    await act(async () => {
      await result.current("shot-1", sampleAnnotations);
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("screenshot_blocks");
    expect(update).toHaveBeenCalledWith({ annotation_json: sampleAnnotations });
    expect(eq).toHaveBeenCalledWith("id", "shot-1");
  });

  it("patches the store with the new annotations so every reader sees them immediately", async () => {
    const eq = vi.fn(() => Promise.resolve({ error: null }));
    mockSupabase.from.mockReturnValue({ update: () => ({ eq }) });

    const { result } = renderHook(() => useUpdateScreenshotAnnotations());
    await act(async () => {
      await result.current("shot-1", sampleAnnotations);
    });

    expect(screenshotBlocksStore.getState().find((b) => b.id === "shot-1")?.annotations).toEqual(sampleAnnotations);
  });

  it("throws and leaves the store untouched when the Supabase write fails", async () => {
    const eq = vi.fn(() => Promise.resolve({ error: new Error("db down") }));
    mockSupabase.from.mockReturnValue({ update: () => ({ eq }) });

    const { result } = renderHook(() => useUpdateScreenshotAnnotations());
    await expect(result.current("shot-1", sampleAnnotations)).rejects.toThrow();
    expect(screenshotBlocksStore.getState().find((b) => b.id === "shot-1")?.annotations).toEqual([]);
  });
});

describe("usePatchScreenshotAnnotationsLocal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    seedBlock();
  });

  it("updates the store's annotations for a block without calling Supabase", () => {
    const { result } = renderHook(() => usePatchScreenshotAnnotationsLocal());
    act(() => {
      result.current("shot-1", sampleAnnotations);
    });

    expect(screenshotBlocksStore.getState().find((b) => b.id === "shot-1")?.annotations).toEqual(sampleAnnotations);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("leaves other blocks in the store untouched", () => {
    screenshotBlocksStore.setState((prev) => [
      ...prev,
      {
        id: "shot-2",
        pageId: "page-1",
        type: "screenshot" as const,
        order: 1,
        imageUrl: "other.png",
        imageWidth: 800,
        imageHeight: 600,
        annotations: [],
        description: "",
        altText: null,
        createdAt: "t",
        updatedAt: "t",
      },
    ]);

    const { result } = renderHook(() => usePatchScreenshotAnnotationsLocal());
    act(() => {
      result.current("shot-1", sampleAnnotations);
    });

    expect(screenshotBlocksStore.getState().find((b) => b.id === "shot-2")?.annotations).toEqual([]);
  });
});
