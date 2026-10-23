import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/spaces/[spaceId]/invite (deprecated)", () => {
  it("returns 410 Gone indicating space invites are deprecated in favor of org invites", async () => {
    const response = await POST();
    expect(response.status).toBe(410);
    const body = await response.json();
    expect(body.error).toBe("SPACE_INVITES_DEPRECATED");
  });
});
