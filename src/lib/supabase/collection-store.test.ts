import { describe, it, expect, vi } from "vitest";
import { createCollectionStore } from "./collection-store";

interface Item {
  id: string;
  name: string;
}

describe("createCollectionStore", () => {
  it("starts empty", () => {
    const store = createCollectionStore<Item>();
    expect(store.getState()).toEqual([]);
  });

  it("populates state from the loader and notifies subscribers", async () => {
    const store = createCollectionStore<Item>();
    const listener = vi.fn();
    store.subscribe(listener);

    store.ensureLoaded("scope-a", async () => [{ id: "1", name: "One" }]);
    await vi.waitFor(() => expect(store.getState()).toEqual([{ id: "1", name: "One" }]));
    expect(listener).toHaveBeenCalled();
  });

  it("only calls the loader once per unique key", async () => {
    const store = createCollectionStore<Item>();
    const loader = vi.fn(async () => [{ id: "1", name: "One" }]);

    store.ensureLoaded("scope-a", loader);
    store.ensureLoaded("scope-a", loader);
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1));

    store.ensureLoaded("scope-a", loader);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("merges rows from different scopes by id instead of overwriting the whole collection", async () => {
    const store = createCollectionStore<Item>();

    store.ensureLoaded("scope-a", async () => [{ id: "1", name: "One" }]);
    await vi.waitFor(() => expect(store.getState()).toHaveLength(1));

    store.ensureLoaded("scope-b", async () => [{ id: "2", name: "Two" }]);
    await vi.waitFor(() => expect(store.getState()).toHaveLength(2));

    expect(store.getState()).toEqual(
      expect.arrayContaining([
        { id: "1", name: "One" },
        { id: "2", name: "Two" },
      ]),
    );
  });

  it("re-fetching the same key replaces stale rows for that id with fresh ones", async () => {
    const store = createCollectionStore<Item>();
    store.ensureLoaded("scope-a", async () => [{ id: "1", name: "One" }]);
    await vi.waitFor(() => expect(store.getState()).toEqual([{ id: "1", name: "One" }]));

    store.invalidate("scope-a");
    store.ensureLoaded("scope-a", async () => [{ id: "1", name: "One (renamed)" }]);
    await vi.waitFor(() => expect(store.getState()).toEqual([{ id: "1", name: "One (renamed)" }]));
  });

  it("allows retrying a key after its loader rejects", async () => {
    const store = createCollectionStore<Item>();
    const failingLoader = vi.fn(async () => {
      throw new Error("network down");
    });
    const onError = vi.fn();

    store.ensureLoaded("scope-a", failingLoader, onError);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    store.ensureLoaded("scope-a", async () => [{ id: "1", name: "One" }]);
    await vi.waitFor(() => expect(store.getState()).toEqual([{ id: "1", name: "One" }]));
  });
});
