import { describe, it, expect } from "vitest";
import { slugify, validateSlug } from "./slug";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Getting Started")).toBe("getting-started");
  });

  it("strips punctuation and collapses consecutive separators into one hyphen", () => {
    expect(slugify("FAQ: Billing & Refunds!!")).toBe("faq-billing-refunds");
  });

  it("strips diacritics (Bahasa Indonesia loanwords, accented names)", () => {
    expect(slugify("Café René")).toBe("cafe-rene");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  -Hello World-  ")).toBe("hello-world");
  });

  it("falls back to 'untitled' for input with no alphanumeric characters", () => {
    expect(slugify("!!!")).toBe("untitled");
    expect(slugify("")).toBe("untitled");
  });
});

describe("validateSlug", () => {
  it("accepts a simple lowercase-hyphenated slug", () => {
    expect(validateSlug("getting-started")).toEqual({ valid: true, reason: null });
  });

  it("accepts a single-word slug", () => {
    expect(validateSlug("dibimbing")).toEqual({ valid: true, reason: null });
  });

  it("rejects an empty slug", () => {
    expect(validateSlug("").valid).toBe(false);
  });

  it("rejects uppercase characters", () => {
    expect(validateSlug("Getting-Started").valid).toBe(false);
  });

  it("rejects underscores and other non-hyphen separators", () => {
    expect(validateSlug("getting_started").valid).toBe(false);
  });

  it("rejects a leading or trailing hyphen", () => {
    expect(validateSlug("-getting-started").valid).toBe(false);
    expect(validateSlug("getting-started-").valid).toBe(false);
  });

  it("rejects consecutive hyphens", () => {
    expect(validateSlug("getting--started").valid).toBe(false);
  });

  it("rejects a reserved platform route word with a specific reason", () => {
    const result = validateSlug("pages");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/dicadangkan/);
  });

  it("rejects 'public', 'api', and 'settings' as reserved", () => {
    expect(validateSlug("public").valid).toBe(false);
    expect(validateSlug("api").valid).toBe(false);
    expect(validateSlug("settings").valid).toBe(false);
  });
});
