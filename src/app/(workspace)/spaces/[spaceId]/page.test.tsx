import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense, type ReactNode } from "react";
import { render, screen, act } from "@testing-library/react";
import SpacePage from "./page";
import type { Space } from "@/lib/types";

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

const baseSpace: Space = {
  id: "space-1",
  organizationId: "org-1",
  name: "Aplikasi Mobile",
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
