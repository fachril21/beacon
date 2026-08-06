/**
 * IndexedDB fallback buffer for in-progress Page edits (PRD.md §5.1
 * "local IndexedDB buffer as a fallback so edits survive offline/crash
 * scenarios and sync automatically on reconnect", Flow 3's failure path).
 * Keyed by pageId — one pending edit per Page, latest write wins.
 */
import { openDB, type IDBPDatabase } from "idb";
import type { SerializedEditorState } from "lexical";

const DB_NAME = "beacon-offline-buffer";
const DB_VERSION = 1;
const STORE_NAME = "pending-page-edits";

interface PendingEditRecord {
  pageId: string;
  content: SerializedEditorState;
  savedAt: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME, { keyPath: "pageId" });
      },
    });
  }
  return dbPromise;
}

export async function savePendingEdit(pageId: string, content: SerializedEditorState): Promise<void> {
  const db = await getDb();
  const record: PendingEditRecord = { pageId, content, savedAt: new Date().toISOString() };
  await db.put(STORE_NAME, record);
}

export async function loadPendingEdit(pageId: string): Promise<SerializedEditorState | null> {
  const db = await getDb();
  const record = (await db.get(STORE_NAME, pageId)) as PendingEditRecord | undefined;
  return record ? record.content : null;
}

export async function clearPendingEdit(pageId: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, pageId);
}
