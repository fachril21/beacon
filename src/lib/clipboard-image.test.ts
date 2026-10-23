import { describe, expect, it } from "vitest";
import { getImageFilesFromClipboard } from "./clipboard-image";

function clipboard(init: {
  items?: Array<{ kind: string; type: string; file?: File }>;
  files?: File[];
}): DataTransfer {
  return {
    items: (init.items ?? []).map((item) => ({
      kind: item.kind,
      type: item.type,
      getAsFile: () => item.file ?? null,
    })),
    files: init.files ?? [],
  } as unknown as DataTransfer;
}

function imageFile(name = "screenshot.png") {
  return new File(["bytes"], name, { type: "image/png" });
}

describe("getImageFilesFromClipboard", () => {
  it("returns image files exposed through clipboard items", () => {
    const file = imageFile();
    const result = getImageFilesFromClipboard(clipboard({ items: [{ kind: "file", type: "image/png", file }] }));
    expect(result).toEqual([file]);
  });

  it("ignores text and other non-image clipboard items", () => {
    const file = imageFile();
    const result = getImageFilesFromClipboard(
      clipboard({
        items: [
          { kind: "string", type: "text/plain" },
          { kind: "file", type: "application/pdf" },
          { kind: "file", type: "image/png", file },
        ],
      }),
    );
    expect(result).toEqual([file]);
  });

  it("falls back to clipboard files when items are empty", () => {
    const file = imageFile();
    expect(getImageFilesFromClipboard(clipboard({ files: [file] }))).toEqual([file]);
  });

  it("returns nothing for a missing or non-image clipboard", () => {
    expect(getImageFilesFromClipboard(null)).toEqual([]);
    expect(getImageFilesFromClipboard(clipboard({ files: [new File(["x"], "a.txt", { type: "text/plain" })] }))).toEqual([]);
  });
});
