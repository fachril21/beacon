import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetPasswordForm } from "./set-password-form";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: (...args: unknown[]) => mockToastSuccess(...args), error: (...args: unknown[]) => mockToastError(...args) }),
}));

const mockUpdatePassword = vi.fn();
const mockUseSession = vi.fn();
vi.mock("@/hooks/use-session", () => ({
  useSession: () => mockUseSession(),
}));

function setSession(overrides: Partial<{ isLoading: boolean; isAuthenticated: boolean }>) {
  mockUseSession.mockReturnValue({
    isLoading: false,
    isAuthenticated: false,
    updatePassword: mockUpdatePassword,
    ...overrides,
  });
}

describe("SetPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a loading state while the session from the email link is still resolving", () => {
    setSession({ isLoading: true });
    render(<SetPasswordForm mode="invite" />);
    expect(screen.getByText(/memuat/i)).toBeInTheDocument();
  });

  it("shows an invalid-link state when there is no session once loading finishes", () => {
    setSession({ isLoading: false, isAuthenticated: false });
    render(<SetPasswordForm mode="recovery" />);
    expect(screen.getByText(/tidak valid|kedaluwarsa/i)).toBeInTheDocument();
  });

  it("shows an inline error when the password and confirmation don't match", async () => {
    setSession({ isLoading: false, isAuthenticated: true });
    const user = userEvent.setup();
    render(<SetPasswordForm mode="invite" />);

    await user.type(screen.getByLabelText(/^kata sandi/i), "password123");
    await user.type(screen.getByLabelText(/konfirmasi/i), "different456");
    await user.click(screen.getByRole("button", { name: /simpan|buat/i }));

    expect(await screen.findByText(/tidak cocok/i)).toBeInTheDocument();
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it("calls updatePassword and redirects to Workspace Home on success", async () => {
    setSession({ isLoading: false, isAuthenticated: true });
    mockUpdatePassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SetPasswordForm mode="invite" />);

    await user.type(screen.getByLabelText(/^kata sandi/i), "password123");
    await user.type(screen.getByLabelText(/konfirmasi/i), "password123");
    await user.click(screen.getByRole("button", { name: /simpan|buat/i }));

    await vi.waitFor(() => expect(mockUpdatePassword).toHaveBeenCalledWith("password123"));
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
  });

  it("shows an error toast when updatePassword fails, without redirecting", async () => {
    setSession({ isLoading: false, isAuthenticated: true });
    mockUpdatePassword.mockRejectedValue(new Error("session expired"));
    const user = userEvent.setup();
    render(<SetPasswordForm mode="recovery" />);

    await user.type(screen.getByLabelText(/^kata sandi/i), "password123");
    await user.type(screen.getByLabelText(/konfirmasi/i), "password123");
    await user.click(screen.getByRole("button", { name: /simpan|buat/i }));

    await vi.waitFor(() => expect(mockToastError).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
  });
});
