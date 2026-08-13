import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpaceCard } from "./space-card";
import type { Space } from "@/lib/types";

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ user: { id: "user-1" } }),
}));

let mockRole: "viewer" | "editor" | "admin" | null = "admin";
const mockDeleteSpace = vi.fn(() => Promise.resolve());
vi.mock("@/hooks/use-spaces", () => ({
  useSpaceRole: () => mockRole,
  useDeleteSpace: () => mockDeleteSpace,
}));

vi.mock("@/hooks/use-pages", () => ({
  usePages: () => [],
  useChildPages: () => [],
}));

const space: Space = {
  id: "space-1",
  organizationId: "org-1",
  name: "Aplikasi Mobile",
  category: null,
  isPublishable: false,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("SpaceCard delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteSpace.mockResolvedValue(undefined);
    mockRole = "admin";
  });

  it("shows the Space menu for an admin", () => {
    render(<SpaceCard space={space} />);
    expect(screen.getByRole("button", { name: "Menu Space" })).toBeInTheDocument();
  });

  it("hides the Space menu for a non-admin", () => {
    mockRole = "editor";
    render(<SpaceCard space={space} />);
    expect(screen.queryByRole("button", { name: "Menu Space" })).not.toBeInTheDocument();
  });

  it("deletes the Space on confirm", async () => {
    render(<SpaceCard space={space} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Menu Space" }));
    await user.click(await screen.findByRole("menuitem", { name: "Hapus Space" }));
    await user.click(await screen.findByRole("button", { name: "Hapus Space" }));

    expect(mockDeleteSpace).toHaveBeenCalledWith("space-1");
  });
});
