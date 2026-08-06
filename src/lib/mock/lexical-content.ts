/**
 * Small builders for hand-authored Lexical SerializedEditorState fixtures.
 * Only used by src/lib/mock/pages.ts — keeps fixture content readable instead
 * of hand-nesting raw JSON node-by-node.
 */
import type { SerializedEditorState, SerializedLexicalNode } from "lexical";

function text(value: string, format = 0) {
  return {
    detail: 0,
    format,
    mode: "normal",
    style: "",
    text: value,
    type: "text",
    version: 1,
  };
}

export function paragraph(value: string) {
  return {
    children: value ? [text(value)] : [],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "paragraph",
    version: 1,
    textFormat: 0,
    textStyle: "",
  };
}

export function heading(tag: "h1" | "h2" | "h3", value: string) {
  return {
    children: [text(value)],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "heading",
    version: 1,
    tag,
  };
}

export function quote(value: string) {
  return {
    children: [text(value)],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "quote",
    version: 1,
  };
}

export function bulletList(items: string[]) {
  return {
    children: items.map((item) => ({
      children: [text(item)],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "listitem",
      version: 1,
      value: 1,
    })),
    direction: "ltr",
    format: "",
    indent: 0,
    type: "list",
    version: 1,
    listType: "bullet",
    start: 1,
    tag: "ul",
  };
}

export function checklist(items: { text: string; checked: boolean }[]) {
  return {
    children: items.map((item) => ({
      children: [text(item.text)],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "listitem",
      version: 1,
      value: 1,
      checked: item.checked,
    })),
    direction: "ltr",
    format: "",
    indent: 0,
    type: "list",
    version: 1,
    listType: "check",
    start: 1,
    tag: "ul",
  };
}

export function codeBlock(code: string, language = "javascript") {
  return {
    children: [text(code)],
    direction: "ltr",
    format: "",
    indent: 0,
    type: "code",
    version: 1,
    language,
  };
}

export function divider() {
  return {
    type: "divider",
    version: 1,
    format: "",
  };
}

export function screenshotNode(screenshotBlockId: string) {
  return {
    type: "screenshot-block",
    version: 1,
    format: "",
    screenshotBlockId,
  };
}

export function doc(children: object[]): SerializedEditorState {
  return {
    root: {
      children: children as unknown as SerializedLexicalNode[],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  } as unknown as SerializedEditorState;
}

export function emptyDoc(): SerializedEditorState {
  return doc([paragraph("")]);
}
