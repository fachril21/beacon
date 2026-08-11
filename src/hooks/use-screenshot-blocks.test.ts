import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { screenshotBlocksStore } from "@/lib/supabase/stores";

const mockSupabase = { from: vi.fn() };
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => mockSupabase }));

const { useScreenshotBlock, useCreateScreenshotBlock, useUpdateScreenshotAnnotation, useUploadScreenshot } = await import(
  "./use-screenshot-blocks"
);

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
      annotation_json: null,
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
      annotation_json: null,
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

describe("useUpdateScreenshotAnnotation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
    screenshotBlocksStore.setState([
      {
        id: "shot-1",
        pageId: "page-1",
        type: "screenshot",
        order: 0,
        imageUrl: "screenshots/page-1/abc.png",
        imageWidth: 800,
        imageHeight: 600,
        annotationJson: null,
        description: "",
        altText: null,
        createdAt: "t",
        updatedAt: "t",
      },
    ]);
  });

  it("updates annotation_json in Supabase and patches the local store", async () => {
    const update = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
    mockSupabase.from.mockReturnValue({ update });

    const annotation = { version: "1", objects: [], nextMarkerNumber: 1 };
    const { result } = renderHook(() => useUpdateScreenshotAnnotation());
    await act(async () => {
      await result.current("shot-1", annotation);
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ annotation_json: annotation }));
    expect(screenshotBlocksStore.getState()[0].annotationJson).toEqual(annotation);
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
              url: "https://s3.example.com/bucket",
              fields: { key: "screenshots/page-1/abc.png", policy: "p" },
              objectKey: "screenshots/page-1/abc.png",
            }),
          };
        }
        // The direct-to-S3 POST.
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
      annotation_json: null,
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
    expect(fetch).toHaveBeenCalledWith("https://s3.example.com/bucket", expect.objectContaining({ method: "POST" }));
    expect(created).toMatchObject({ id: "shot-1", imageUrl: "screenshots/page-1/abc.png" });
  });

  it("throws when the S3 upload itself fails, without creating a DB row", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/s3/presign") {
          return {
            ok: true,
            json: async () => ({ url: "https://s3.example.com/bucket", fields: {}, objectKey: "k" }),
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
