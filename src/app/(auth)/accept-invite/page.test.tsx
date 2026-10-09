import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams("token=tok-1"),
}));

let mockUser: { id: string } | null = null;
vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ user: mockUser, isLoading: false }),
}));

const mockAccept = vi.fn();
vi.mock("@/hooks/use-organizations", () => ({
  useAcceptOrganizationInvite: () => mockAccept,
}));

const { default: AcceptInvitePage } = await import("./page");

describe("AcceptInvitePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockAccept.mockResolvedValue(undefined);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("holds the processing state through the grace period, then shows the fallback only if no session ever arrives", async () => {
    render(<AcceptInvitePage />);

    expect(screen.getByText("Memproses undangan…")).toBeTruthy();
    expect(mockAccept).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("Anda diundang ke sebuah Organisasi")).toBeTruthy();
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it("accepts the invitation and routes to the set-password step once a session exists", async () => {
    mockUser = { id: "invitee-1" };
    render(<AcceptInvitePage />);

    await vi.waitFor(() => expect(mockAccept).toHaveBeenCalledWith("tok-1"));
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledWith("/complete-invite"));
  });
});
