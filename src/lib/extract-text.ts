import type { PartialBlock as BNPartialBlock } from "@blocknote/core";
import { normalizePageContent } from "@/lib/legacy-lexical-content";

interface LooseInline {
  type?: string;
  text?: string;
  content?: unknown;
}

interface LooseCell {
  content?: unknown;
}

interface LooseTableContent {
  rows?: { cells?: unknown[] }[];
}

/** Flattens a BlockNote block tree into plain text, for search snippets. Also accepts legacy (pre-BlockNote-migration) Lexical content, normalizing it first. */
export function extractPlainText(blocks: unknown): string {
  if (!blocks) return "";
  const normalized = normalizePageContent(blocks);
  const parts: string[] = [];
  normalized.forEach((block) => walkBlock(block, parts));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function walkBlock(block: BNPartialBlock, parts: string[]) {
  walkContent(block.content, parts);
  (block.children as BNPartialBlock[] | undefined)?.forEach((child) => walkBlock(child, parts));
}

function walkContent(content: unknown, parts: string[]) {
  if (!content) return;
  if (typeof content === "string") {
    if (content) parts.push(content);
    return;
  }
  if (Array.isArray(content)) {
    content.forEach((item) => walkInline(item, parts));
    return;
  }
  (content as LooseTableContent).rows?.forEach((row) => row.cells?.forEach((cell) => walkCell(cell, parts)));
}

function walkCell(cell: unknown, parts: string[]) {
  if (Array.isArray(cell)) {
    cell.forEach((item) => walkInline(item, parts));
    return;
  }
  const content = (cell as LooseCell)?.content;
  if (Array.isArray(content)) content.forEach((item) => walkInline(item, parts));
}

function walkInline(item: unknown, parts: string[]) {
  const node = item as LooseInline;
  if (!node) return;
  if (typeof node.text === "string" && node.text) parts.push(node.text);
  if (node.type === "link" && Array.isArray(node.content)) {
    node.content.forEach((child) => walkInline(child, parts));
  }
}

export function snippetAround(text: string, query: string, radius = 60): string {
  if (!query) return text.slice(0, radius * 2);
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
