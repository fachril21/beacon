import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountMenu } from "./account-menu";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const signOut = vi.fn();
let sessionUser: { id: string; name: string; email: string } | null = null;
vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ user: sessionUser, signOut }) }));

describe("AccountMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionUser = { id: "me", name: "Fachril Zulfidar", email: "fachril@dibimbing.id" };
  });

  it("shows the name and the email the user is logged in with", () => {
    render(<AccountMenu />);
    expect(screen.getByText("Fachril Zulfidar")).toBeInTheDocument();
    expect(screen.getByText("fachril@dibimbing.id")).toBeInTheDocument();
  });

  it("shows just the email when the profile has no name, and an initial taken from it", () => {
    sessionUser = { id: "me", name: "", email: "fachril@dibimbing.id" };
    render(<AccountMenu />);
    expect(screen.getByText("fachril@dibimbing.id")).toBeInTheDocument();
    expect(screen.getByText("F")).toBeInTheDocument();
    expect(screen.queryByText("?")).not.toBeInTheDocument();
  });

  it("repeats the logged-in email at the top of the opened menu", async () => {
    const user = userEvent.setup();
    render(<AccountMenu />);
    await user.click(screen.getByRole("button", { name: /fachril@dibimbing\.id/ }));

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Masuk sebagai")).toBeInTheDocument();
    expect(within(menu).getByText("fachril@dibimbing.id")).toBeInTheDocument();
  });

  it("keeps the organization settings and sign-out actions", async () => {
    const user = userEvent.setup();
    render(<AccountMenu />);
    await user.click(screen.getByRole("button", { name: /fachril@dibimbing\.id/ }));

    await user.click(await screen.findByRole("menuitem", { name: /Pengaturan Organisasi/ }));
    expect(push).toHaveBeenCalledWith("/settings/organization");

    await user.click(screen.getByRole("button", { name: /fachril@dibimbing\.id/ }));
    await user.click(await screen.findByRole("menuitem", { name: /Keluar/ }));
    expect(signOut).toHaveBeenCalled();
  });

  it("renders a neutral placeholder, not a crash, before the session has loaded", () => {
    sessionUser = null;
    render(<AccountMenu />);
    expect(screen.getByRole("button", { name: /Akun/ })).toBeInTheDocument();
  });
});
