/**
 * Small builders for hand-authored BlockNote PartialBlock fixtures.
 * Only used by src/lib/mock/pages.ts and src/lib/mock/versions.ts — keeps
 * fixture content readable instead of hand-nesting raw JSON block-by-block.
 */
import type { PageContent } from "@/lib/types";

export function paragraph(value: string) {
  return {
    type: "paragraph" as const,
    content: value,
  };
}

export function heading(level: 1 | 2 | 3, value: string) {
  return {
    type: "heading" as const,
    props: { level },
    content: value,
  };
}

export function quote(value: string) {
  return {
    type: "quote" as const,
    content: value,
  };
}

export function bulletList(items: string[]) {
  return items.map((item) => ({
    type: "bulletListItem" as const,
    content: item,
  }));
}

export function checklist(items: { text: string; checked: boolean }[]) {
  return items.map((item) => ({
    type: "checkListItem" as const,
    props: { checked: item.checked },
    content: item.text,
  }));
}

export function codeBlock(code: string, language = "javascript") {
  return {
    type: "codeBlock" as const,
    props: { language },
    content: code,
  };
}

export function divider() {
  return { type: "divider" as const };
}

export function screenshotBlock(screenshotBlockId: string) {
  return {
    type: "screenshot" as const,
    props: { screenshotBlockId },
  };
}

export function doc(children: object[]): PageContent {
  return children as PageContent;
}

export function emptyDoc(): PageContent {
  return doc([paragraph("")]);
}
