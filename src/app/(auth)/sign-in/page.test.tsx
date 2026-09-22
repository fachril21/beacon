import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import SignInPage from "./page";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ signIn: vi.fn() }),
  InvalidCredentialsError: class InvalidCredentialsError extends Error {},
}));

vi.mock("@/lib/supabase/env", () => ({
  getKerjainForgotPasswordUrl: () => "https://kerjain-liard.vercel.app/forgot-password",
}));

describe("SignInPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends 'Lupa kata sandi?' to Kerjain's forgot-password page instead of Beacon's own — password recovery is consolidated on Kerjain", () => {
    render(<SignInPage />);

    const link = screen.getByRole("link", { name: /lupa kata sandi/i });
    expect(link).toHaveAttribute("href", "https://kerjain-liard.vercel.app/forgot-password");
  });
});
