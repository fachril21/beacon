/**
 * A Store<T[]> (src/lib/store.ts) that lazily populates itself from an async
 * Supabase query instead of a static mock array. Every Epic 11+ collection
 * hook (usePages, useSpaces, ...) is `useSyncExternalStore` over one of
 * these, so a mutation from one component stays instantly visible to every
 * other component reading the same collection — same guarantee Stage 1's
 * mock store gave, now backed by a real fetch.
 *
 * Rows accumulate across scopes (e.g. usePages(spaceA) then usePages(spaceB)
 * both write into the same store) and are merged by id, matching how the
 * mock store always held every row and let hooks filter client-side.
 */
import { createStore, type Store } from "@/lib/store";

interface Identified {
  id: string;
}

export interface CollectionStore<T extends Identified> extends Store<T[]> {
  /** Fetches once per unique `key` (e.g. a spaceId); a repeat call while a
   * previous load for that key is in flight or already settled is a no-op. */
  ensureLoaded: (key: string, loader: () => Promise<T[]>, onError?: (error: unknown) => void) => void;
  /** Forces the next `ensureLoaded` for this key to fetch again. */
  invalidate: (key: string) => void;
}

export function createCollectionStore<T extends Identified>(): CollectionStore<T> {
  const store = createStore<T[]>([]);
  const settledKeys = new Set<string>();
  const inFlightKeys = new Set<string>();

  function ensureLoaded(key: string, loader: () => Promise<T[]>, onError?: (error: unknown) => void) {
    if (settledKeys.has(key) || inFlightKeys.has(key)) return;
    inFlightKeys.add(key);

    loader()
      .then((rows) => {
        settledKeys.add(key);
        store.setState((prev) => {
          const byId = new Map(prev.map((item) => [item.id, item]));
          for (const row of rows) byId.set(row.id, row);
          return Array.from(byId.values());
        });
      })
      .catch((error: unknown) => {
        onError?.(error);
      })
      .finally(() => {
        inFlightKeys.delete(key);
      });
  }

  function invalidate(key: string) {
    settledKeys.delete(key);
  }

  return { ...store, ensureLoaded, invalidate };
}
