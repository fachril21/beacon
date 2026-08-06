/**
 * Minimal external store for Stage 1's mock data layer. Hooks in src/hooks/
 * subscribe to these via useSyncExternalStore so that a mutation from one
 * component (e.g. creating a Page) is immediately visible to every other
 * component reading the same collection (e.g. the sidebar), without a state
 * management library — matching PROJECT.md §11's "no state library beyond
 * React state/context unless a screen genuinely needs more."
 *
 * Stage 2 replaces the internals of each hook with real Supabase calls; this
 * file itself is mock-only infrastructure and is not part of the schema.
 */

export interface Store<T> {
  getState: () => T;
  setState: (updater: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState: (updater) => {
      state = typeof updater === "function" ? (updater as (prev: T) => T)(state) : updater;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
