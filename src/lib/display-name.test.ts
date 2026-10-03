import { describe, it, expect } from "vitest";
import { displayName } from "./display-name";

describe("displayName", () => {
  it("uses the profile name when there is one", () => {
    expect(displayName({ name: "Fachril Zulfidar", email: "fachril@example.com" })).toBe("Fachril Zulfidar");
  });

  it("falls back to the full email when the name is empty or blank", () => {
    expect(displayName({ name: "", email: "fachril@example.com" })).toBe("fachril@example.com");
    expect(displayName({ name: "   ", email: " sari.dewi@example.com " })).toBe("sari.dewi@example.com");
  });

  it("falls back to a generic label when neither is available", () => {
    expect(displayName({ name: "", email: "" })).toBe("Pengguna");
    expect(displayName(undefined)).toBe("Pengguna");
  });
});
