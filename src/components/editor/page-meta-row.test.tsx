import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageMetaRow } from "./page-meta-row";
import type { Page } from "@/lib/types";

vi.mock("@/hooks/use-users", () => ({
  useUser: () => ({ id: "user-1", name: "Fachril", avatarUrl: null }),
}));

const mockHelpfulnessRate = vi.fn<(pageId: string | undefined) => { yes: number; total: number; rate: number | null }>(() => ({ yes: 0, total: 0, rate: null }));
vi.mock("@/hooks/use-feedback", () => ({
  useHelpfulnessRate: (pageId: string | undefined) => mockHelpfulnessRate(pageId),
}));

const page: Page = {
  id: "page-1",
  spaceId: "space-1",
  parentPageId: null,
  title: "Untitled",
  order: 0,
  content: [],
  visibility: "internal",
  slug: null,
  isPublished: true,
  publishedContentSnapshot: null,
  publishedAt: null,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: new Date().toISOString(),
};

describe("PageMetaRow", () => {
  it("shows the author and a relative last-edited time", () => {
    render(<PageMetaRow page={page} canEdit />);
    expect(screen.getByText("Fachril · diubah baru saja")).toBeInTheDocument();
  });
});

// Moved from page-editor-toolbar.test.tsx: the badge left the breadcrumb for the meta row under the title.
describe("PageMetaRow helpfulness rate (US15.2)", () => {
  it("shows the aggregate helpfulness rate to an admin on a published page with responses", () => {
    mockHelpfulnessRate.mockReturnValue({ yes: 2, total: 3, rate: 2 / 3 });
    render(<PageMetaRow page={page} canEdit />);
    expect(screen.getByText(/67%/)).toBeInTheDocument();
    expect(screen.getByText(/3 respons/)).toBeInTheDocument();
  });

  it("shows nothing for a page with zero responses yet", () => {
    mockHelpfulnessRate.mockReturnValue({ yes: 0, total: 0, rate: null });
    render(<PageMetaRow page={page} canEdit />);
    expect(screen.queryByText(/respons/)).not.toBeInTheDocument();
  });

  it("never shows the helpfulness rate to a viewer, and never queries for it (feedback_select_editor RLS mirror)", () => {
    mockHelpfulnessRate.mockClear();
    mockHelpfulnessRate.mockReturnValue({ yes: 2, total: 3, rate: 2 / 3 });
    render(<PageMetaRow page={page} canEdit={false} />);
    expect(screen.queryByText(/respons/)).not.toBeInTheDocument();
    expect(mockHelpfulnessRate).toHaveBeenCalledWith(undefined);
  });

  it("doesn't query for a draft page", () => {
    mockHelpfulnessRate.mockClear();
    render(<PageMetaRow page={{ ...page, isPublished: false }} canEdit />);
    expect(mockHelpfulnessRate).toHaveBeenCalledWith(undefined);
  });
});
