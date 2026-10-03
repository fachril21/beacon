"use client";

/**
 * Which comments each user has already read, per page and block: the
 * timestamp of the newest comment they have seen there. The block cue in the
 * editor shows only for comments newer than this. Kept in localStorage — no
 * server round trip and no schema — so it is per browser, not per account.
 */
import { useSyncExternalStore } from "react";
import { createStore } from "@/lib/store";

const STORAGE_KEY = "beacon.commentReads.v1";

/** `${userId}:${pageId}:${blockId}` → ISO time of the newest comment read there. */
type ReadMarks = Readonly<Record<string, string>>;

function loadMarks(): ReadMarks {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as ReadMarks) : {};
  } catch {
    return {};
  }
}

function persist(marks: ReadMarks): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(marks));
  } catch {
    // Storage unavailable or full: the marks still work for this session.
  }
}

const marksStore = createStore<ReadMarks>(loadMarks());

const markKey = (userId: string, pageId: string, blockId: string) => `${userId}:${pageId}:${blockId}`;

/** Records that `userId` has read this block's comments up to `upToIso`; never moves backwards. */
export function markCommentsRead(userId: string, pageId: string, blockId: string, upToIso: string): void {
  const key = markKey(userId, pageId, blockId);
  const current = marksStore.getState()[key];
  if (current !== undefined && current >= upToIso) return;
  const next = { ...marksStore.getState(), [key]: upToIso };
  marksStore.setState(next);
  persist(next);
}

export function lastReadAt(marks: ReadMarks, userId: string, pageId: string, blockId: string): string | undefined {
  return marks[markKey(userId, pageId, blockId)];
}

export function useCommentReadMarks(): ReadMarks {
  return useSyncExternalStore(marksStore.subscribe, marksStore.getState, () => ({}));
}

/** Forgets every read mark (also used by tests). */
export function clearCommentReadMarks(): void {
  marksStore.setState({});
}
