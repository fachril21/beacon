import type { SerializedEditorState } from "lexical";

interface LooseNode {
  type?: string;
  text?: string;
  children?: LooseNode[];
}

/** Flattens a Lexical SerializedEditorState into plain text, for search snippets. */
export function extractPlainText(state: SerializedEditorState): string {
  const root = (state as unknown as { root?: LooseNode }).root;
  if (!root) return "";
  const parts: string[] = [];
  walk(root, parts);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function walk(node: LooseNode, parts: string[]) {
  if (typeof node.text === "string" && node.text) parts.push(node.text);
  node.children?.forEach((child) => walk(child, parts));
}

export function snippetAround(text: string, query: string, radius = 60): string {
  if (!query) return text.slice(0, radius * 2);
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
