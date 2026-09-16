import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense, type ReactNode } from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SpaceSettingsPage from "./page";
import type { Space } from "@/lib/types";

const paramsPromise = Promise.resolve({ spaceId: "space-1" });

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

let mockUser: { id: string } | null = { id: "user-1" };
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: mockUser }) }));

let mockRole: "viewer" | "editor" | "admin" | null = "admin";
let mockSpace: Space | undefined;
const mockUpdateSpace = vi.fn(() => Promise.resolve());
vi.mock("@/hooks/use-spaces", () => ({
  useSpace: () => mockSpace,
  useSpaceRole: () => mockRole,
  useUpdateSpace: () => mockUpdateSpace,
}));

const baseSpace: Space = {
  id: "space-1",
  organizationId: "org-1",
  name: "Aplikasi Mobile",
  slug: "test-space",
  category: null,
  isPublishable: false,
  createdByUserId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

async function renderPage() {
  let utils!: ReturnType<typeof render>;
  // `use(params)` suspends; the async act flush lets the boundary resume.
  await act(async () => {
    utils = render(
      <Suspense fallback={null}>
        <SpaceSettingsPage params={paramsPromise} />
      </Suspense>,
    );
  });
  return utils;
}

describe("SpaceSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: "user-1" };
    mockRole = "admin";
    mockSpace = { ...baseSpace };
    mockUpdateSpace.mockResolvedValue(undefined);
  });

  it("shows the publishable toggle reflecting the Space's current setting for an admin", async () => {
    mockSpace = { ...baseSpace, isPublishable: true };
    await renderPage();

    const toggle = await screen.findByRole("switch", { name: /dapat dipublikasikan/i });
    expect(toggle).toBeChecked();
  });

  it("renders a not-found state for a non-admin, with no toggle", async () => {
    mockRole = "editor";
    await renderPage();

    expect(await screen.findByText("Halaman tidak ditemukan")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("turns publishing on immediately, without a confirmation step", async () => {
    mockSpace = { ...baseSpace, isPublishable: false };
    await renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("switch", { name: /dapat dipublikasikan/i }));

    expect(mockUpdateSpace).toHaveBeenCalledWith("space-1", { isPublishable: true });
  });

  it("asks for confirmation before turning publishing off, then updates on confirm", async () => {
    mockSpace = { ...baseSpace, isPublishable: true };
    await renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("switch", { name: /dapat dipublikasikan/i }));
    expect(mockUpdateSpace).not.toHaveBeenCalled();

    await user.click(await screen.findByRole("button", { name: "Jadikan Internal" }));
    expect(mockUpdateSpace).toHaveBeenCalledWith("space-1", { isPublishable: false });
  });

  it("renames the Space when an admin edits the name and saves", async () => {
    mockSpace = { ...baseSpace, name: "Aplikasi Mobile" };
    await renderPage();
    const user = userEvent.setup();

    const nameInput = await screen.findByLabelText("Nama Space");
    await user.clear(nameInput);
    await user.type(nameInput, "Aplikasi Mobile v2");
    await user.click(screen.getByRole("button", { name: "Simpan" }));

    expect(mockUpdateSpace).toHaveBeenCalledWith("space-1", { name: "Aplikasi Mobile v2" });
  });

  it("keeps the save button disabled while the name is unchanged or blank", async () => {
    mockSpace = { ...baseSpace, name: "Aplikasi Mobile" };
    await renderPage();
    const user = userEvent.setup();

    const nameInput = await screen.findByLabelText("Nama Space");
    expect(screen.getByRole("button", { name: "Simpan" })).toBeDisabled();

    await user.clear(nameInput);
    expect(screen.getByRole("button", { name: "Simpan" })).toBeDisabled();

    await user.type(nameInput, "Something new");
    expect(screen.getByRole("button", { name: "Simpan" })).toBeEnabled();
  });
});
