import { describe, it, expect } from "vitest";
import { buildDocObjectKey, InvalidDocPathError } from "./doc-key";

describe("buildDocObjectKey", () => {
  it("joins allowed path segments under the docs/ prefix", () => {
    expect(buildDocObjectKey(["handbook", "intro.pdf"])).toBe("docs/handbook/intro.pdf");
  });

  it("allows every extension on the allowlist", () => {
    for (const ext of ["pdf", "png", "jpg", "jpeg", "gif", "webp", "svg"]) {
      expect(buildDocObjectKey([`file.${ext}`])).toBe(`docs/file.${ext}`);
    }
  });

  it("rejects an empty path", () => {
    expect(() => buildDocObjectKey([])).toThrow(InvalidDocPathError);
  });

  it("rejects a .. traversal segment", () => {
    expect(() => buildDocObjectKey(["..", "etc", "passwd.pdf"])).toThrow(InvalidDocPathError);
  });

  it("rejects a segment that embeds a path separator", () => {
    expect(() => buildDocObjectKey(["a/../../etc/passwd.pdf"])).toThrow(InvalidDocPathError);
  });

  it("rejects a disallowed file extension", () => {
    expect(() => buildDocObjectKey(["malware.exe"])).toThrow(InvalidDocPathError);
  });

  it("rejects a file name with no extension", () => {
    expect(() => buildDocObjectKey(["no-extension"])).toThrow(InvalidDocPathError);
  });

  it("is case-insensitive about the extension", () => {
    expect(buildDocObjectKey(["Report.PDF"])).toBe("docs/Report.PDF");
  });
});
