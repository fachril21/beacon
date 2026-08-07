import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot, $createParagraphNode, $createTextNode, type LexicalEditor, type ElementNode } from "lexical";
import { LinkNode, $createLinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { FloatingLinkEditorPlugin } from "./floating-link-editor-plugin";

beforeAll(() => {
  Range.prototype.getBoundingClientRect = () =>
    ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
});

function Harness({ onReady }: { onReady: (editor: LexicalEditor) => void }) {
  const [editor] = useLexicalComposerContext();
  onReady(editor);
  return null;
}

function renderEditor() {
  let editor!: LexicalEditor;

  render(
    <LexicalComposer
      initialConfig={{
        namespace: "test",
        nodes: [LinkNode],
        onError: (e) => {
          throw e;
        },
      }}
    >
      <Harness onReady={(e) => (editor = e)} />
      <RichTextPlugin
        contentEditable={<ContentEditable aria-label="editor" />}
        placeholder={null}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <LinkPlugin />
      <FloatingLinkEditorPlugin />
    </LexicalComposer>,
  );

  screen.getByLabelText("editor").focus();
  return editor;
}

function buildExistingLink(editor: LexicalEditor, url = "https://example.com") {
  act(() => {
    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        const link = $createLinkNode(url);
        const text = $createTextNode("click here");
        link.append(text);
        paragraph.append(link);
        $getRoot().clear().append(paragraph);
        text.select(2, 2);
      },
      { discrete: true },
    );
  });
}

describe("FloatingLinkEditorPlugin", () => {
  it("shows nothing when the selection is not on a link", () => {
    const editor = renderEditor();
    act(() => {
      editor.update(
        () => {
          const paragraph = $createParagraphNode();
          const text = $createTextNode("hello world");
          paragraph.append(text);
          $getRoot().clear().append(paragraph);
          text.select(2, 2);
        },
        { discrete: true },
      );
    });

    expect(screen.queryByText("https://example.com")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("URL tautan")).not.toBeInTheDocument();
  });

  it("shows the URL in view mode when the cursor lands on an existing link", () => {
    const editor = renderEditor();
    buildExistingLink(editor);

    expect(screen.getByText("https://example.com")).toBeInTheDocument();
    expect(screen.queryByLabelText("URL tautan")).not.toBeInTheDocument();
  });

  it("auto-enters edit mode with an empty input for a freshly created (https://) link", () => {
    const editor = renderEditor();
    act(() => {
      editor.update(
        () => {
          const paragraph = $createParagraphNode();
          const text = $createTextNode("hello world");
          paragraph.append(text);
          $getRoot().clear().append(paragraph);
          text.select(0, 5);
        },
        { discrete: true },
      );
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
      editor.update(() => {}, { discrete: true }); // force-flush the batched update from dispatchCommand
    });

    const input = screen.getByLabelText("URL tautan") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("");
  });

  it("typing a URL and pressing Enter sets the link's URL", async () => {
    const user = userEvent.setup();
    const editor = renderEditor();
    act(() => {
      editor.update(
        () => {
          const paragraph = $createParagraphNode();
          const text = $createTextNode("hello world");
          paragraph.append(text);
          $getRoot().clear().append(paragraph);
          text.select(0, 5);
        },
        { discrete: true },
      );
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
      editor.update(() => {}, { discrete: true }); // force-flush the batched update from dispatchCommand
    });

    const input = screen.getByLabelText("URL tautan");
    await user.type(input, "example.com{Enter}");

    editor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow<ElementNode>();
      const link = paragraph.getFirstChildOrThrow();
      expect($isLinkNode(link)).toBe(true);
      expect(link.getTextContent()).toBe("hello");
    });
  });

  it("removes a freshly created link entirely when Escape is pressed before typing anything", () => {
    const editor = renderEditor();
    act(() => {
      editor.update(
        () => {
          const paragraph = $createParagraphNode();
          const text = $createTextNode("hello world");
          paragraph.append(text);
          $getRoot().clear().append(paragraph);
          text.select(0, 5);
        },
        { discrete: true },
      );
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, "https://");
      editor.update(() => {}, { discrete: true }); // force-flush the batched update from dispatchCommand
    });

    const input = screen.getByLabelText("URL tautan");
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      editor.update(() => {}, { discrete: true }); // force-flush the batched update from the Escape handler
    });

    editor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow<ElementNode>();
      expect(paragraph.getTextContent()).toBe("hello world");
      expect(paragraph.getChildren().some((child) => $isLinkNode(child))).toBe(false);
    });
  });

  it("clicking the edit button opens edit mode prefilled with the current URL", async () => {
    const user = userEvent.setup();
    const editor = renderEditor();
    buildExistingLink(editor);

    await user.click(screen.getByRole("button", { name: "Ubah tautan" }));

    const input = screen.getByLabelText("URL tautan") as HTMLInputElement;
    expect(input.value).toBe("https://example.com");
  });

  it("clicking the trash button removes an existing link but keeps its text", async () => {
    const user = userEvent.setup();
    const editor = renderEditor();
    buildExistingLink(editor);

    await user.click(screen.getByRole("button", { name: "Hapus tautan" }));

    editor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChildOrThrow<ElementNode>();
      const firstChild = paragraph.getFirstChildOrThrow();
      expect($isLinkNode(firstChild)).toBe(false);
      expect(firstChild.getTextContent()).toBe("click here");
    });
  });
});
