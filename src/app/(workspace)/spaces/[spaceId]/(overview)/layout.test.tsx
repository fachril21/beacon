import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense, type ReactNode } from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import SpaceOverviewLayout from "./layout";
import type { Organization, Space } from "@/lib/types";

const paramsPromise = Promise.resolve({ spaceId: "space-1" });

let mockPathname = "/spaces/space-1";
const mockPush = vi.fn();
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: { id: "user-1" } }) }));

let mockRole: "viewer" | "editor" | "admin" | null = "admin";
let mockSpace: Space | undefined;
vi.mock("@/hooks/use-spaces", () => ({
  useSpace: () => mockSpace,
  useSpaceRole: () => mockRole,
}));

const mockCreatePage = vi.fn();
vi.mock("@/hooks/use-pages", () => ({
  useCreatePage: () => mockCreatePage,
}));

let mockOrganization: Organization | undefined;
vi.mock("@/hooks/use-organizations", () => ({
  useOrganization: () => mockOrganization,
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

const baseOrganization: Organization = {
  id: "org-1",
  name: "Acme Inc",
  slug: "acme",
  domain: null,
  isDomainVerified: false,
  pendingDnsToken: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

async function renderLayout() {
  let utils!: ReturnType<typeof render>;
  // `use(params)` suspends; the async act flush lets the boundary resume.
  await act(async () => {
    utils = render(
      <Suspense fallback={null}>
        <SpaceOverviewLayout params={paramsPromise}>
          <div>Tab content</div>
        </SpaceOverviewLayout>
      </Suspense>,
    );
  });
  return utils;
}

describe("SpaceOverviewLayout tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/spaces/space-1";
    mockRole = "admin";
    mockSpace = { ...baseSpace };
    mockOrganization = { ...baseOrganization };
  });

  it("shows an admin a Pengaturan tab pointing at the Space settings page", async () => {
    await renderLayout();
    const link = await screen.findByRole("link", { name: /pengaturan/i });
    expect(link).toHaveAttribute("href", "/spaces/space-1/settings");
  });

  it("hides the Anggota and Pengaturan tabs from a non-admin", async () => {
    mockRole = "editor";
    await renderLayout();
    await screen.findByRole("heading", { name: "Aplikasi Mobile" });
    expect(screen.queryByRole("link", { name: /pengaturan/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^anggota$/i })).not.toBeInTheDocument();
  });

  it("still renders the Halaman tab's children for a non-admin", async () => {
    mockRole = "editor";
    await renderLayout();
    expect(await screen.findByText("Tab content")).toBeInTheDocument();
  });

  it("creates a new Page and navigates to it when the header's Halaman baru is clicked", async () => {
    mockCreatePage.mockResolvedValue({ id: "new-page" });
    await renderLayout();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /halaman baru/i }));

    expect(mockCreatePage).toHaveBeenCalledWith({
      spaceId: "space-1",
      parentPageId: null,
      title: "Halaman tanpa judul",
      createdByUserId: "user-1",
    });
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledWith("/spaces/space-1/pages/new-page"));
  });
});

describe("SpaceOverviewLayout role gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = "admin";
    mockSpace = { ...baseSpace };
    mockOrganization = { ...baseOrganization };
  });

  it("renders a not-found state for a non-admin visiting the Anggota route", async () => {
    mockPathname = "/spaces/space-1/members";
    mockRole = "editor";
    await renderLayout();

    expect(await screen.findByText("Halaman tidak ditemukan")).toBeInTheDocument();
    expect(screen.queryByText("Tab content")).not.toBeInTheDocument();
  });

  it("renders a not-found state for a non-admin visiting the Pengaturan route", async () => {
    mockPathname = "/spaces/space-1/settings";
    mockRole = "editor";
    await renderLayout();

    expect(await screen.findByText("Halaman tidak ditemukan")).toBeInTheDocument();
  });
});

describe("SpaceOverviewLayout public URL sharing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/spaces/space-1";
    mockRole = "editor";
    mockSpace = { ...baseSpace, isPublishable: true };
    mockOrganization = { ...baseOrganization };
  });

  it("shows a share public URL button to any member when the Space is publishable", async () => {
    await renderLayout();
    expect(await screen.findByRole("button", { name: /salin link publik/i })).toBeInTheDocument();
  });

  it("hides the share button when the Space is not publishable", async () => {
    mockSpace = { ...baseSpace, isPublishable: false };
    await renderLayout();
    await screen.findByRole("heading", { name: "Aplikasi Mobile" });
    expect(screen.queryByRole("button", { name: /salin link publik/i })).not.toBeInTheDocument();
  });

  it("copies the public URL to the clipboard and confirms with a toast when clicked", async () => {
    const user = userEvent.setup();
    await renderLayout();
    const button = await screen.findByRole("button", { name: /salin link publik/i });
    const mockWriteText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    await user.click(button);

    expect(mockWriteText).toHaveBeenCalledWith(`${window.location.origin}/public/acme/spaces/test-space`);
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/disalin/i));
  });
});
