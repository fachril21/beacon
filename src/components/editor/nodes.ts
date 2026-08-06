import type { Klass, LexicalNode } from "lexical";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ListNode, ListItemNode } from "@lexical/list";
import { CodeNode } from "@lexical/code";
import { TableNode, TableCellNode, TableRowNode } from "@lexical/table";
import { LinkNode } from "@lexical/link";
import { DividerNode } from "./divider-node";
import { ScreenshotNode } from "./screenshot-node";

export const editorNodes: Array<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  LinkNode,
  DividerNode,
  ScreenshotNode,
];
