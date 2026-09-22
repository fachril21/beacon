import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForgotPasswordPage from "./page";

const mockRequestPasswordReset = vi.fn();
vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ requestPasswordReset: mockRequestPasswordReset }),
}));

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the same confirmation whether or not requestPasswordReset succeeds, to avoid leaking which emails have accounts", async () => {
    mockRequestPasswordReset.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.click(screen.getByRole("button", { name: /kirim tautan atur ulang/i }));

    expect(await screen.findByText("Periksa email Anda")).toBeInTheDocument();
  });

  it("logs the underlying error to the console when requestPasswordReset throws, without changing the confirmation shown to the user", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const misconfiguration = new Error("Missing required environment variable: NEXT_PUBLIC_KERJAIN_RESET_PASSWORD_URL");
    mockRequestPasswordReset.mockRejectedValue(misconfiguration);
    const user = userEvent.setup();
    render(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.click(screen.getByRole("button", { name: /kirim tautan atur ulang/i }));

    expect(await screen.findByText("Periksa email Anda")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("requestPasswordReset"), misconfiguration);

    consoleError.mockRestore();
  });
});
