import { describe, it, expect } from "vitest";
import { screenshotUploadErrorMessage } from "./upload-error";

describe("screenshotUploadErrorMessage", () => {
  it("maps FILE_TOO_LARGE to a size-specific Indonesian message", () => {
    expect(screenshotUploadErrorMessage(new Error("FILE_TOO_LARGE"))).toMatch(/terlalu besar/i);
  });

  it("maps INVALID_FILE_TYPE to a file-type message", () => {
    expect(screenshotUploadErrorMessage(new Error("INVALID_FILE_TYPE"))).toMatch(/gambar/i);
  });

  it("falls back to a generic retry message for an unknown error code", () => {
    expect(screenshotUploadErrorMessage(new Error("boom"))).toMatch(/coba lagi/i);
  });

  it("falls back to the generic message for a non-Error value", () => {
    expect(screenshotUploadErrorMessage("nope")).toMatch(/coba lagi/i);
  });
});
