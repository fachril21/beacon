import { DecoratorNode, type LexicalNode, type SerializedLexicalNode, type Spread } from "lexical";
import type { JSX } from "react";

export type SerializedDividerNode = Spread<{ type: "divider"; version: 1 }, SerializedLexicalNode>;

export class DividerNode extends DecoratorNode<JSX.Element> {
  static getType(): string {
    return "divider";
  }

  static clone(node: DividerNode): DividerNode {
    return new DividerNode(node.__key);
  }

  static importJSON(): DividerNode {
    return new DividerNode();
  }

  exportJSON(): SerializedDividerNode {
    return { type: "divider", version: 1 };
  }

  createDOM(): HTMLElement {
    return document.createElement("div");
  }

  updateDOM(): false {
    return false;
  }

  decorate(): JSX.Element {
    return <hr className="my-6 border-t border-border" />;
  }

  isInline(): boolean {
    return false;
  }
}

export function $createDividerNode(): DividerNode {
  return new DividerNode();
}

export function $isDividerNode(node: LexicalNode | null | undefined): node is DividerNode {
  return node instanceof DividerNode;
}
