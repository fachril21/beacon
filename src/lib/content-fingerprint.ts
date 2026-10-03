import { normalizePageContent } from "@/lib/legacy-lexical-content";

/**
 * A canonical string for "what this document says", used to decide whether
 * two saves are really different. BlockNote's own output differs between
 * otherwise-identical documents — it regenerates block ids, fills in default
 * props, and keeps (or adds, when you click below the last line) a trailing
 * empty paragraph — so a raw JSON compare reports a change where the user
 * changed nothing. Typing and then deleting text yields the same fingerprint
 * as before the typing.
 */

/** BlockNote's default prop values; a prop equal to its default carries no information. */
const DEFAULT_PROPS: Record<string, unknown> = {
  textColor: "default",
  backgroundColor: "default",
  textAlignment: "left",
};

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

/** Inline content as a canonical array; a plain string becomes one text run. */
function canonicalInline(content: unknown): Json {
  if (typeof content === "string") return content ? [canonicalValue({ type: "text", text: content }, false)] : [];
  if (Array.isArray(content)) {
    return content.map((item) => canonicalValue(item, false)).filter((item) => !isEmptyValue(item)) as Json;
  }
  return canonicalValue(content, false);
}

function canonicalValue(value: unknown, isProps: boolean): Json {
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item, false)) as Json;
  if (value === null || typeof value !== "object") return (value ?? null) as Json;

  const entries: [string, Json][] = [];
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const raw = (value as Record<string, unknown>)[key];
    if (key === "id") continue; // block ids are regenerated freely
    if (isProps && key in DEFAULT_PROPS && raw === DEFAULT_PROPS[key]) continue;
    const next = key === "content" ? canonicalInline(raw) : canonicalValue(raw, key === "props");
    if (isEmptyValue(next)) continue;
    entries.push([key, next]);
  }
  return Object.fromEntries(entries);
}

function isEmptyParagraph(block: unknown): boolean {
  const canonical = block as { type?: string; content?: unknown; children?: unknown };
  return canonical.type === "paragraph" && isEmptyValue(canonical.content) && isEmptyValue(canonical.children);
}

export function contentFingerprint(content: unknown): string {
  const blocks = (content ? normalizePageContent(content) : []) as unknown[];
  const canonical = blocks.map((block) => canonicalValue(block, false));
  while (canonical.length > 0 && isEmptyParagraph(canonical[canonical.length - 1])) canonical.pop();
  return JSON.stringify(canonical);
}
