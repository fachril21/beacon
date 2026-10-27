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
   * previous load for that key is in flight or already settled is a no-op.
   * Resolves `true` once that key's rows are in the store, `false` if the
   * load failed — so a caller can tell "not loaded yet" from "loaded, absent". */
  ensureLoaded: (key: string, loader: () => Promise<T[]>, onError?: (error: unknown) => void) => Promise<boolean>;
  /** Forces the next `ensureLoaded` for this key to fetch again. */
  invalidate: (key: string) => void;
}

export function createCollectionStore<T extends Identified>(): CollectionStore<T> {
  const store = createStore<T[]>([]);
  const settledKeys = new Set<string>();
  const inFlight = new Map<string, Promise<boolean>>();

  function ensureLoaded(key: string, loader: () => Promise<T[]>, onError?: (error: unknown) => void): Promise<boolean> {
    if (settledKeys.has(key)) return Promise.resolve(true);
    const pending = inFlight.get(key);
    if (pending) return pending;

    const load = loader()
      .then((rows) => {
        settledKeys.add(key);
        store.setState((prev) => {
          const byId = new Map(prev.map((item) => [item.id, item]));
          for (const row of rows) byId.set(row.id, row);
          return Array.from(byId.values());
        });
        return true;
      })
      .catch((error: unknown) => {
        onError?.(error);
        return false;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, load);
    return load;
  }

  function invalidate(key: string) {
    settledKeys.delete(key);
  }

  return { ...store, ensureLoaded, invalidate };
}
