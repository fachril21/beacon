import { describe, it, expect } from "vitest";
import { describePublishError } from "./publish-error";

describe("describePublishError", () => {
  it("explains a permission failure (SQLSTATE 42501)", () => {
    expect(describePublishError({ code: "42501", message: "x" })).toMatch(/izin/i);
  });

  it("explains a missing database function (PGRST202) as a pending migration", () => {
    expect(describePublishError({ code: "PGRST202", message: "Could not find the function" })).toMatch(/migrasi/i);
  });

  it("explains an undefined column or function (42703 / 42883) as a pending migration", () => {
    expect(describePublishError({ code: "42703", message: "column does not exist" })).toMatch(/migrasi/i);
    expect(describePublishError({ code: "42883", message: "function unaccent(text) does not exist" })).toMatch(/migrasi/i);
  });

  it("explains a slug collision (23505)", () => {
    expect(describePublishError({ code: "23505", message: "duplicate key" })).toMatch(/slug/i);
  });

  it("explains a network failure", () => {
    expect(describePublishError(new TypeError("Failed to fetch"))).toMatch(/koneksi/i);
  });

  it("falls back to a generic message for unknown errors", () => {
    expect(describePublishError("boom")).toBe("Terjadi kesalahan tak terduga.");
    expect(describePublishError(null)).toBe("Terjadi kesalahan tak terduga.");
  });
});
