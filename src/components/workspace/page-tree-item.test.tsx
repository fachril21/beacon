import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";
import { PageTreeItem } from "./page-tree-item";
import type { Page } from "@/lib/types";

const mockPush = vi.fn();
let mockPathname = "/spaces/space-1";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ user: { id: "user-1" } }),
}));

let mockRole: "viewer" | "editor" | "admin" | null = "editor";
vi.mock("@/hooks/use-spaces", () => ({
  useSpaceRole: () => mockRole,
}));

const mockDeletePage = vi.fn(() => Promise.resolve());
vi.mock("@/hooks/use-pages", () => ({
  useChildPages: () => [],
  useCreatePage: () => vi.fn(),
  useDeletePage: () => mockDeletePage,
}));

const page: Page = {
  id: "page-1",
  spaceId: "space-1",
  parentPageId: null,
  title: "Panduan Onboarding",
  order: 0,
  content: [],
  visibility: "internal",
  slug: null,
  isPublished: false,
  publishedContentSnapshot: null,
  publishedAt: null,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderItem() {
  return render(
    <DndContext>
      <PageTreeItem page={page} spaceId="space-1" depth={1} />
    </DndContext>,
  );
}

describe("PageTreeItem delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeletePage.mockResolvedValue(undefined);
    mockRole = "editor";
    mockPathname = "/spaces/space-1";
  });

  it("shows a menu with Hapus for an editor", async () => {
    renderItem();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Menu halaman" }));
    expect(await screen.findByRole("menuitem", { name: "Hapus" })).toBeInTheDocument();
  });

  it("hides the menu entirely for a viewer", () => {
    mockRole = "viewer";
    renderItem();
    expect(screen.queryByRole("button", { name: "Menu halaman" })).not.toBeInTheDocument();
  });

  it("deletes the page on confirm and does not navigate away when it isn't the open page", async () => {
    mockPathname = "/spaces/space-1/pages/some-other-page";
    renderItem();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Menu halaman" }));
    await user.click(await screen.findByRole("menuitem", { name: "Hapus" }));
    await user.click(await screen.findByRole("button", { name: "Hapus" }));

    expect(mockDeletePage).toHaveBeenCalledWith("page-1");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects to the Space when the deleted page is the one currently open", async () => {
    mockPathname = "/spaces/space-1/pages/page-1";
    renderItem();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Menu halaman" }));
    await user.click(await screen.findByRole("menuitem", { name: "Hapus" }));
    await user.click(await screen.findByRole("button", { name: "Hapus" }));

    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledWith("/spaces/space-1"));
  });
});
