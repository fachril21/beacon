import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageEditorToolbar } from "./page-editor-toolbar";
import type { Page, Space } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/use-organizations", () => ({
  useOrganization: () => ({ id: "org-1", isDomainVerified: true }),
}));

vi.mock("@/hooks/use-pages", () => ({
  usePublishActions: () => ({ publish: vi.fn(), update: vi.fn(), unpublish: vi.fn() }),
  hasUnpublishedChanges: () => false,
  getPageStatus: () => "draft",
}));

const mockHelpfulnessRate = vi.fn(() => ({ yes: 0, total: 0, rate: null as number | null }));
vi.mock("@/hooks/use-feedback", () => ({
  useHelpfulnessRate: () => mockHelpfulnessRate(),
}));

const space: Space = {
  id: "space-1",
  organizationId: "org-1",
  name: "Test Space",
  category: null,
  isPublishable: true,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const draftPage: Page = {
  id: "page-1",
  spaceId: "space-1",
  parentPageId: null,
  title: "Untitled",
  order: 0,
  content: [],
  visibility: "internal",
  isPublished: false,
  publishedContentSnapshot: null,
  publishedAt: null,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderToolbar(role: "viewer" | "editor" | "admin" | null) {
  return render(
    <PageEditorToolbar page={draftPage} space={space} title={draftPage.title} saveStatus="idle" role={role} />,
  );
}

describe("PageEditorToolbar role gating (US17.2)", () => {
  it("shows the Publish button for an editor", () => {
    renderToolbar("editor");
    expect(screen.getByRole("button", { name: "Publikasikan" })).toBeInTheDocument();
  });

  it("shows the Publish button for an admin", () => {
    renderToolbar("admin");
    expect(screen.getByRole("button", { name: "Publikasikan" })).toBeInTheDocument();
  });

  it("hides the Publish button for a viewer", () => {
    renderToolbar("viewer");
    expect(screen.queryByRole("button", { name: "Publikasikan" })).not.toBeInTheDocument();
  });

  it("hides the Publish button when the user has no permission row at all", () => {
    renderToolbar(null);
    expect(screen.queryByRole("button", { name: "Publikasikan" })).not.toBeInTheDocument();
  });

  it("hides the overflow menu's Unpublish action for a viewer even on a published page", () => {
    render(
      <PageEditorToolbar
        page={{ ...draftPage, isPublished: true }}
        space={space}
        title={draftPage.title}
        saveStatus="idle"
        role="viewer"
      />,
    );
    // Update button (shown for editors/admins on published pages) must not render for a viewer.
    expect(screen.queryByRole("button", { name: "Perbarui" })).not.toBeInTheDocument();
  });
});

describe("PageEditorToolbar helpfulness rate (US15.2)", () => {
  it("shows the aggregate helpfulness rate to an admin on a published page with responses", () => {
    mockHelpfulnessRate.mockReturnValue({ yes: 2, total: 3, rate: 2 / 3 });
    render(
      <PageEditorToolbar
        page={{ ...draftPage, isPublished: true }}
        space={space}
        title={draftPage.title}
        saveStatus="idle"
        role="admin"
      />,
    );
    expect(screen.getByText(/67%/)).toBeInTheDocument();
    expect(screen.getByText(/3 respons/)).toBeInTheDocument();
  });

  it("shows nothing for a page with zero responses yet", () => {
    mockHelpfulnessRate.mockReturnValue({ yes: 0, total: 0, rate: null });
    render(
      <PageEditorToolbar
        page={{ ...draftPage, isPublished: true }}
        space={space}
        title={draftPage.title}
        saveStatus="idle"
        role="admin"
      />,
    );
    expect(screen.queryByText(/respons/)).not.toBeInTheDocument();
  });

  it("never shows the helpfulness rate to a viewer, even with responses (feedback_select_editor RLS mirror)", () => {
    mockHelpfulnessRate.mockReturnValue({ yes: 2, total: 3, rate: 2 / 3 });
    render(
      <PageEditorToolbar
        page={{ ...draftPage, isPublished: true }}
        space={space}
        title={draftPage.title}
        saveStatus="idle"
        role="viewer"
      />,
    );
    expect(screen.queryByText(/respons/)).not.toBeInTheDocument();
  });
});
