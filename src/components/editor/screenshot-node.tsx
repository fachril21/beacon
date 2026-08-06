import {
  DecoratorNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { JSX } from "react";
import { ScreenshotBlockView } from "./screenshot-block-view";

export type SerializedScreenshotNode = Spread<
  { type: "screenshot-block"; version: 1; screenshotBlockId: string },
  SerializedLexicalNode
>;

export class ScreenshotNode extends DecoratorNode<JSX.Element> {
  __screenshotBlockId: string;

  static getType(): string {
    return "screenshot-block";
  }

  static clone(node: ScreenshotNode): ScreenshotNode {
    return new ScreenshotNode(node.__screenshotBlockId, node.__key);
  }

  constructor(screenshotBlockId: string, key?: NodeKey) {
    super(key);
    this.__screenshotBlockId = screenshotBlockId;
  }

  static importJSON(serializedNode: SerializedScreenshotNode): ScreenshotNode {
    return new ScreenshotNode(serializedNode.screenshotBlockId);
  }

  exportJSON(): SerializedScreenshotNode {
    return { type: "screenshot-block", version: 1, screenshotBlockId: this.__screenshotBlockId };
  }

  setScreenshotBlockId(id: string): void {
    const writable = this.getWritable();
    writable.__screenshotBlockId = id;
  }

  static importDOM(): DOMConversionMap | null {
    return null;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div");
    element.setAttribute("data-lexical-screenshot-block", this.__screenshotBlockId);
    return { element };
  }

  createDOM(): HTMLElement {
    const div = document.createElement("div");
    div.className = "my-4";
    return div;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <ScreenshotBlockView blockId={this.__screenshotBlockId} nodeKey={this.getKey()} />;
  }

  isInline(): boolean {
    return false;
  }
}

export function $createScreenshotNode(screenshotBlockId: string): ScreenshotNode {
  return new ScreenshotNode(screenshotBlockId);
}

export function $isScreenshotNode(node: LexicalNode | null | undefined): node is ScreenshotNode {
  return node instanceof ScreenshotNode;
}
