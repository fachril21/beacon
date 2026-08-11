/**
 * Compatibility shim for Pages/Versions written before the BlockNote
 * migration, whose `content` column still holds Lexical's
 * SerializedEditorState JSON (`{root:{type:"root",children:[...]}}`).
 * BlockNote's `initialContent` throws ("must be a non-empty array of
 * blocks") if handed that shape directly, so every content-consuming
 * surface (PageEditor, PublicPageContent) runs stored content through
 * `normalizePageContent` first. This is a best-effort structural
 * conversion, not a byte-exact port — good enough to open the page again
 * without data loss for the common block types; any edit afterwards
 * autosaves the converted BlockNote shape back to Supabase.
 */
import type { PageContent } from "@/lib/types";

interface LexicalNode {
  type?: string;
  tag?: string;
  text?: string;
  checked?: boolean;
  listType?: string;
  language?: string;
  screenshotBlockId?: string;
  children?: LexicalNode[];
}

interface LegacyLexicalContent {
  root: LexicalNode;
}

/** True when `content` is the old Lexical `{root:{...}}` shape rather than BlockNote's `Block[]` array. */
export function isLegacyLexicalContent(content: unknown): content is LegacyLexicalContent {
  return !!content && typeof content === "object" && !Array.isArray(content) && "root" in (content as Record<string, unknown>);
}

function extractText(node: LexicalNode | undefined): string {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  return (node.children ?? []).map(extractText).join("");
}

const HEADING_LEVEL: Record<string, 1 | 2 | 3> = { h1: 1, h2: 2, h3: 3 };
const LIST_ITEM_TYPE: Record<string, string> = {
  bullet: "bulletListItem",
  number: "numberedListItem",
  check: "checkListItem",
};

function convertListItem(node: LexicalNode, listType: string): Record<string, unknown> {
  const type = LIST_ITEM_TYPE[listType] ?? "bulletListItem";
  const block: Record<string, unknown> = { type, content: extractText(node) };
  if (type === "checkListItem") block.props = { checked: node.checked ?? false };
  return block;
}

function convertNode(node: LexicalNode): Record<string, unknown>[] {
  switch (node.type) {
    case "heading":
      return [{ type: "heading", props: { level: HEADING_LEVEL[node.tag ?? "h1"] ?? 1 }, content: extractText(node) }];
    case "paragraph":
      return [{ type: "paragraph", content: extractText(node) }];
    case "quote":
      return [{ type: "quote", content: extractText(node) }];
    case "code":
      return [{ type: "codeBlock", props: node.language ? { language: node.language } : {}, content: extractText(node) }];
    case "divider":
      return [{ type: "divider" }];
    case "screenshot-block":
      return [{ type: "screenshot", props: { screenshotBlockId: node.screenshotBlockId ?? "" } }];
    case "list":
      return (node.children ?? []).map((item) => convertListItem(item, node.listType ?? "bullet"));
    case "table": {
      const rows = (node.children ?? [])
        .filter((row) => row.type === "tablerow")
        .map((row) => ({
          cells: (row.children ?? []).filter((cell) => cell.type === "tablecell").map((cell) => extractText(cell)),
        }));
      return rows.length > 0 ? [{ type: "table", content: { type: "tableContent", rows } }] : [];
    }
    default: {
      const text = extractText(node);
      return text ? [{ type: "paragraph", content: text }] : [];
    }
  }
}

function convertLegacyLexicalContent(content: LegacyLexicalContent): PageContent {
  const blocks = (content.root.children ?? []).flatMap(convertNode);
  return (blocks.length > 0 ? blocks : [{ type: "paragraph", content: "" }]) as PageContent;
}

/** Passes BlockNote content through unchanged; converts legacy Lexical content on the fly. */
export function normalizePageContent(content: unknown): PageContent {
  if (isLegacyLexicalContent(content)) return convertLegacyLexicalContent(content);
  return content as PageContent;
}
