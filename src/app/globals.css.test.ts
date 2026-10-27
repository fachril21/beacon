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

describe("globals.css — line hierarchy (GitBook-style row structure)", () => {
  it("steps every heading level down through the DESIGN.md §3.1 type tokens", () => {
    const levelToken: Record<string, string> = {
      "1": "--text-h1",
      "2": "--text-h2",
      "3": "--text-h3",
      "4": "--text-h4",
    };

    for (const [level, token] of Object.entries(levelToken)) {
      const rule = css.match(
        new RegExp(
          `\\[data-content-type=["']heading["']\\]\\[data-level=["']${level}["']\\][^{]*\\{[^}]*`,
        ),
      );
      expect(rule?.[0], `heading level ${level} rule`).toBeDefined();
      expect(rule?.[0]).toContain(`font-size: var(${token})`);
    }
  });

  it("gives deeper headings a lighter weight than H1 so the levels read apart", () => {
    const h1 = css.match(/\[data-level=["']1["']\][^{]*\{[^}]*font-weight:\s*(\d+)/);
    const h2 = css.match(/\[data-level=["']2["']\][^{]*\{[^}]*font-weight:\s*(\d+)/);

    expect(Number(h1?.[1])).toBe(700);
    expect(Number(h2?.[1])).toBe(600);
  });

  it("keeps body rows on the 15px/1.6 body token without letting them widen past the column", () => {
    const bodyRule = css.match(/\.bn-root:not\(\.beacon-reading\) \.bn-block-content\s*\{[^}]*\}/);

    expect(bodyRule?.[0]).toContain("font-size: var(--text-body)");
    expect(bodyRule?.[0]).toContain("line-height: 1.6");
    expect(bodyRule?.[0]).toContain("overflow-wrap: break-word");
  });

  it("scopes the body size out of the public reading surface, which keeps body-lg", () => {
    expect(css).toMatch(/\.bn-root:not\(\.beacon-reading\)/);
    expect(css).toMatch(/\.beacon-reading \.bn-block-content\[data-content-type="paragraph"\][^{]*\{[^}]*--text-body-lg/);
  });

  it("retunes the drag-handle heights to the new heading metrics so rows stay centred", () => {
    for (const level of ["1", "2", "3"]) {
      expect(css).toMatch(
        new RegExp(`\.bn-side-menu\\[data-block-type=["']heading["']\\]\\[data-level=["']${level}["']\\][^{]*\\{\\s*height:`),
      );
    }
  });
});

describe("globals.css — stepper (GitBook-style multi-step process)", () => {
  it("lays each step out as a numbered rail plus a content column", () => {
    expect(css).toContain("--step-rail: 1.75rem");
    expect(css).toContain("--step-gutter: 2rem");
    expect(css).toContain("grid-template-columns: var(--step-rail) minmax(0, 1fr)");
    expect(css).toContain("column-gap: var(--step-gutter)");
  });

  it("puts the step body in the content column so it aligns with the title", () => {
    expect(css).toMatch(/\[data-content-type="step"\]\)\s*>\s*\.bn-block-group\s*\{[^}]*grid-column: 2;/);
    expect(css).toMatch(/\[data-content-type="step"\]\)\s*>\s*\.bn-block-group\s*\{[^}]*margin-left: 0;/);
  });

  it("draws the connector on the block so it spans the whole body and stops before the next circle", () => {
    const connector = css.match(/\[data-content-type="step"\]\)::after\s*\{[^}]*\}/)?.[0];

    expect(connector).toBeDefined();
    expect(connector).toContain("top: calc(var(--step-rail) + var(--step-line-start))");
    expect(connector).toContain("bottom: var(--step-line-end)");
    expect(connector).toContain("left: calc(var(--step-rail) / 2 - var(--step-line-width) / 2)");
    expect(connector).toContain("background: var(--border)");
  });

  it("removes the connector from the last step of a group", () => {
    expect(css).toMatch(/\.beacon-step\[data-last="true"\]\)::after\s*\{\s*content: none;/);
  });

  it("keeps the last step's + visible and reveals other per-step controls on hover", () => {
    expect(css).toMatch(/\.bn-root \.beacon-step-add\s*\{\s*opacity: 0;/);
    expect(css).toMatch(/\.beacon-step\[data-last="true"\] \.beacon-step-add\s*\{\s*opacity: 0\.7;/);
    expect(css).not.toContain(".beacon-stepper-add");
    expect(css).not.toContain(".beacon-step-remove");
  });

  it("gives nested steps a smaller, muted title and muted body copy", () => {
    expect(css).toMatch(/\.beacon-step\[data-nested="true"\] \.beacon-step-title\s*\{[^}]*font-size: var\(--text-h3\)/);
    expect(css).toMatch(/\.beacon-step\[data-nested="true"\] \.beacon-step-title\s*\{[^}]*color: var\(--muted-foreground\)/);
    expect(css).toMatch(/\.beacon-step\[data-nested="true"\]\)\s*>\s*\.bn-block-group\s*\{[^}]*color: var\(--muted-foreground\)/);
  });

  it("shrinks the rail, type, and spacing on small screens", () => {
    expect(css).toMatch(/@media \(max-width: 767px\) \{\s*\.bn-root \{\s*--step-rail: 1\.5rem;/);
    expect(css).toMatch(/@media \(max-width: 767px\) \{[\s\S]*?\.beacon-step-title\s*\{\s*font-size: var\(--text-h3\);/);
  });

  it("uses theme tokens rather than hardcoded colors for the stepper surface", () => {
    const stepper = css.slice(css.indexOf("--- Stepper"), css.indexOf("Public reading surface"));
    const hardcoded = stepper.match(/#[0-9a-fA-F]{3,8}\b/g);

    expect(hardcoded).toBeNull();
    expect(stepper).toContain("var(--border)");
    expect(stepper).toContain("var(--muted-foreground)");
  });
});
