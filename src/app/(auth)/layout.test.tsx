import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import AuthLayout from "./layout";

const mockReplace = vi.fn();
let mockPathname = "/sign-in";
let mockIsAuthenticated = false;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
}));

vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

describe("AuthLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/sign-in";
    mockIsAuthenticated = false;
  });

  it("redirects an authenticated visitor away from a plain auth page like sign-in", () => {
    mockPathname = "/sign-in";
    mockIsAuthenticated = true;
    render(<AuthLayout>content</AuthLayout>);

    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("does not redirect away from complete-invite even once authenticated, since that page needs the session to render its set-password form", () => {
    mockPathname = "/complete-invite";
    mockIsAuthenticated = true;
    render(<AuthLayout>content</AuthLayout>);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not redirect away from accept-invite even once authenticated, since an existing-Account invite's recovery-style email link establishes a session right on arrival and the page must stay to call accept_organization_invite", () => {
    mockPathname = "/accept-invite";
    mockIsAuthenticated = true;
    render(<AuthLayout>content</AuthLayout>);

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
