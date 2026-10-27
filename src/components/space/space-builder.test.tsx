import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { SpaceBuilder } from "./space-builder";
import type { Page, Space, SpaceLayout } from "@/lib/types";
import type { UpdateSpacePatch } from "@/hooks/use-spaces";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const mockUpdateSpace = vi.fn<(id: string, patch: UpdateSpacePatch) => Promise<void>>();
vi.mock("@/hooks/use-spaces", () => ({ useUpdateSpace: () => mockUpdateSpace }));

function makePage(overrides: Partial<Page> & Pick<Page, "id" | "title">): Page {
  return {
    spaceId: "space-1",
    parentPageId: null,
    description: "",
    emoji: null,
    order: 0,
    content: [],
    visibility: "publishable",
    slug: overrides.title.toLowerCase().replace(/\s+/g, "-"),
    isPublished: true,
    publishedContentSnapshot: null,
    publishedAt: "2026-01-01T00:00:00.000Z",
    createdByUserId: "user-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const space: Space = {
  id: "space-1",
  organizationId: "org-1",
  name: "Tracer",
  slug: "tracer",
  category: "Produk",
  description: "Panduan Tracer",
  icon: "🚀",
  isPublishable: true,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  layout: {
    version: 1,
    sections: [{ id: "s1", title: "Informasi Umum", columns: 2, pages: [{ pageId: "p1" }, { pageId: "p2" }] }],
  },
};

const pages = [makePage({ id: "p1", title: "Penjelasan" }), makePage({ id: "p2", title: "Dokumentasi" })];

describe("SpaceBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateSpace.mockResolvedValue(undefined);
  });

  it("renders the saved sections, page cards, and live preview", () => {
    render(<SpaceBuilder space={space} pages={pages} />);

    expect(screen.getByLabelText("Judul Space")).toHaveValue("Tracer");
    expect(screen.getByLabelText("Judul bagian 1")).toHaveValue("Informasi Umum");
    expect(screen.getAllByText("Penjelasan").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Dokumentasi").length).toBeGreaterThan(0);
    expect(screen.getByText("Pratinjau")).toBeInTheDocument();
  });

  it("adds a section and saves the Space title plus the new layout", async () => {
    const user = userEvent.setup();
    render(<SpaceBuilder space={space} pages={pages} />);

    await user.click(screen.getByRole("button", { name: /tambah bagian/i }));
    expect(screen.getByLabelText("Judul bagian 2")).toHaveValue("Bagian baru");

    const nameInput = screen.getByLabelText("Judul Space");
    await user.clear(nameInput);
    await user.type(nameInput, "Tracer v2");
    await user.click(screen.getByRole("button", { name: /simpan perubahan/i }));

    await waitFor(() => expect(mockUpdateSpace).toHaveBeenCalledTimes(1));
    const [id, patch] = mockUpdateSpace.mock.calls[0];
    expect(id).toBe("space-1");
    expect(patch).toMatchObject({ name: "Tracer v2", description: "Panduan Tracer", icon: "🚀" });
    const layout = patch.layout as SpaceLayout;
    expect(layout.sections).toHaveLength(2);
    expect(layout.sections[1]).toMatchObject({ title: "Bagian baru" });
    expect(toast.success).toHaveBeenCalledWith("Layout Space disimpan.");
  });

  it("keeps Save disabled until something changes", async () => {
    render(<SpaceBuilder space={space} pages={pages} />);
    expect(screen.getByRole("button", { name: /simpan perubahan/i })).toBeDisabled();
  });

  it("does not save an empty Space title", async () => {
    const user = userEvent.setup();
    render(<SpaceBuilder space={space} pages={pages} />);

    await user.clear(screen.getByLabelText("Judul Space"));

    expect(screen.getByRole("button", { name: /simpan perubahan/i })).toBeDisabled();
  });
});
