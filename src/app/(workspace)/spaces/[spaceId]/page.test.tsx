import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense, type ReactNode } from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import SpacePage from "./page";
import type { Organization, Space } from "@/lib/types";

const paramsPromise = Promise.resolve({ spaceId: "space-1" });

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
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
  useDeleteSpace: () => vi.fn(),
}));
vi.mock("@/hooks/use-pages", () => ({
  useChildPages: () => [],
  useCreatePage: () => vi.fn(),
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

async function renderPage() {
  let utils!: ReturnType<typeof render>;
  // `use(params)` suspends; the async act flush lets the boundary resume.
  await act(async () => {
    utils = render(
      <Suspense fallback={null}>
        <SpacePage params={paramsPromise} />
      </Suspense>,
    );
  });
  return utils;
}

describe("SpacePage settings entry point", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = "admin";
    mockSpace = { ...baseSpace };
    mockOrganization = { ...baseOrganization };
  });

  it("shows an admin a link to the Space settings page", async () => {
    await renderPage();
    const link = await screen.findByRole("link", { name: /pengaturan/i });
    expect(link).toHaveAttribute("href", "/spaces/space-1/settings");
  });

  it("hides the settings link from a non-admin", async () => {
    mockRole = "editor";
    await renderPage();
    await screen.findByRole("heading", { name: "Aplikasi Mobile" });
    expect(screen.queryByRole("link", { name: /pengaturan/i })).not.toBeInTheDocument();
  });
});

describe("SpacePage public URL sharing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = "editor";
    mockSpace = { ...baseSpace, isPublishable: true };
    mockOrganization = { ...baseOrganization };
  });

  it("shows a share public URL button to any member when the Space is publishable", async () => {
    await renderPage();
    expect(await screen.findByRole("button", { name: /salin link publik/i })).toBeInTheDocument();
  });

  it("hides the share button when the Space is not publishable", async () => {
    mockSpace = { ...baseSpace, isPublishable: false };
    await renderPage();
    await screen.findByRole("heading", { name: "Aplikasi Mobile" });
    expect(screen.queryByRole("button", { name: /salin link publik/i })).not.toBeInTheDocument();
  });

  it("copies the public URL to the clipboard and confirms with a toast when clicked", async () => {
    const user = userEvent.setup();
    await renderPage();
    const button = await screen.findByRole("button", { name: /salin link publik/i });
    const mockWriteText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    await user.click(button);

    expect(mockWriteText).toHaveBeenCalledWith(`${window.location.origin}/public/acme/spaces/test-space`);
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/disalin/i));
  });
});
