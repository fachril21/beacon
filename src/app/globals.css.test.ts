import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(__dirname, "globals.css"), "utf8");

describe("globals.css — BlockNote stylesheet wiring", () => {
  it("imports BlockNote's base editor stylesheet", () => {
    // Without this import, BlockNote block content (headings, lists, quotes,
    // checklists, code blocks) renders as unstyled plain text/native
    // controls — the exact "messy" regression this guards against.
    expect(css).toMatch(/@import\s+["']@blocknote\/shadcn\/style\.css["']/);
  });

  it("imports BlockNote's Inter font stylesheet", () => {
    expect(css).toMatch(/@import\s+["']@blocknote\/core\/fonts\/inter\.css["']/);
  });

  it("layers the BlockNote import into `base` so Beacon's .bn-root theme overrides in @layer components still win the cascade", () => {
    expect(css).toMatch(/@import\s+["']@blocknote\/shadcn\/style\.css["']\s+layer\(base\)/);
  });

  it("gives checklist checkboxes the primary (green) accent instead of the native blue default", () => {
    expect(css).toMatch(/checkListItem["']\]\s+input\[type=["']checkbox["']\]\s*{\s*accent-color:\s*var\(--primary\)/);
  });
});
