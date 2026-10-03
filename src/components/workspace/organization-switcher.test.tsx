import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrganizationSwitcher } from "./organization-switcher";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: { id: "me" } }) }));

const organization = { id: "org-1", name: "Dibimbing", slug: "dibimbing" };
vi.mock("@/hooks/use-organizations", () => ({
  useMyOrganizations: () => [organization],
  useCurrentOrganization: () => organization,
  useSetActiveOrganization: () => vi.fn(),
  useCreateOrganization: () => vi.fn(),
}));

describe("OrganizationSwitcher", () => {
  it("shows the Beacon logo next to the current organization's name, not a placeholder icon", () => {
    render(<OrganizationSwitcher />);
    expect(screen.getByText("Dibimbing")).toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: /Dibimbing/ });
    // The Beacon mark: three white blocks and three lime arcs.
    expect(trigger.querySelectorAll("path[fill='white']")).toHaveLength(3);
    expect(trigger.querySelectorAll("path[stroke='#C1F571']")).toHaveLength(3);
    // ...and the old generic shield is gone.
    expect(trigger.querySelector("path[d^='M12 2 4 6']")).toBeNull();
  });
});
