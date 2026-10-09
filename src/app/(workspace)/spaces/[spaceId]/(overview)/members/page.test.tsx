import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense } from "react";
import { render, act } from "@testing-library/react";
import SpaceMembersPage from "./page";

const paramsPromise = Promise.resolve({ spaceId: "space-1" });
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe("SpaceMembersPage redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects visitors back to the Space overview since space-level invites are deprecated", async () => {
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <SpaceMembersPage params={paramsPromise} />
        </Suspense>,
      );
    });

    expect(mockReplace).toHaveBeenCalledWith("/spaces/space-1");
  });
});
