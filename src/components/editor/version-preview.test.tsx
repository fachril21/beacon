import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VersionPreview } from "./version-preview";
import type { PageContent, Version } from "@/lib/types";

const content = [
  { id: "b1", type: "paragraph", props: {}, content: [{ type: "text", text: "Isi dari versi lama", styles: {} }], children: [] },
] as unknown as PageContent;

const version: Version = {
  id: "v-1",
  pageId: "page-1",
  title: "Judul lama",
  content,
  createdByUserId: "user-1",
  createdAt: "2026-01-02T03:04:00.000Z",
  isRestoreOf: null,
};

describe("VersionPreview", () => {
  it("shows the old version's content in a read-only editor, under a banner saying it is not the live draft", () => {
    const { container } = render(<VersionPreview version={version} />);

    expect(screen.getByText("Pratinjau versi — bukan draf yang sedang aktif")).toBeInTheDocument();
    expect(screen.getByText("Isi dari versi lama")).toBeInTheDocument();
    expect(container.querySelector(".bn-editor")).toHaveAttribute("contenteditable", "false");
  });
});
