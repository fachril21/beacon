import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { screenshotBlocksStore } from "@/lib/supabase/stores";

const mockSupabase = { from: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => mockSupabase }));

const { useScreenshotBlock, useCreateScreenshotBlock, useUploadScreenshot, useUpdateScreenshotAnnotations, usePatchScreenshotAnnotationsLocal } =
  await import("./use-screenshot-blocks");

function resetStore() {
  screenshotBlocksStore.setState([]);
  screenshotBlocksStore.invalidate("all");
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
        // The direct-to-S3 PUT (Backblaze B2's S3-compatible API doesn't support presigned POST).
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
