import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

// The real "server-only" package unconditionally throws unless resolved
// through Next.js's bundler (which swaps in a no-op via the "react-server"
// package.json export condition). Vitest doesn't set that condition, so
// every server-only module (Supabase server/admin clients, S3 presign) would
// fail to import in tests without this.
vi.mock("server-only", () => ({}));

// jsdom has no ResizeObserver; cmdk (the Command palette/combobox primitive)
// observes its list element to recalculate height, which throws without this.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

// jsdom also has no scrollIntoView; cmdk calls it on the active item.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
