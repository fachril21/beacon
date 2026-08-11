import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { PageEditor } from "./page-editor";
import { emptyDoc } from "@/lib/mock/blocknote-content";
import type { Page } from "@/lib/types";

vi.mock("@/hooks/use-page-autosave", () => ({
  usePageAutosave: () => ({ status: "idle", scheduleSave: vi.fn() }),
}));

const page: Page = {
  id: "page-1",
  spaceId: "space-1",
  parentPageId: null,
  title: "Untitled",
  order: 0,
  content: emptyDoc(),
  visibility: "internal",
  isPublished: false,
  publishedContentSnapshot: null,
  publishedAt: null,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("PageEditor editable prop", () => {
  it("reflects the `editable` prop on the underlying contentEditable root, including after a late-arriving role (US17.2)", () => {
    // Mirrors PageEditorPage: role starts null (permissions still loading) -> editable=false
    // on first mount, then flips true once useSpaceRole resolves a moment later.
    const { container, rerender } = render(<PageEditor page={page} editable={false} />);
    const editableRoot = container.querySelector(".bn-editor");
    expect(editableRoot).toHaveAttribute("contenteditable", "false");

    rerender(<PageEditor page={page} editable={true} />);
    expect(editableRoot).toHaveAttribute("contenteditable", "true");
  });
});
