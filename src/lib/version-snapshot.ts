import { contentFingerprint } from "@/lib/content-fingerprint";
import type { PageContent, Version } from "@/lib/types";

/** Minimum gap between automatic version snapshots of one Page while it is being edited. */
export const VERSION_SNAPSHOT_INTERVAL_MS = 60 * 1000;

/** True when `version` already holds exactly this title + content (ignoring block ids / trailing empty lines, so saving it again would be noise). */
export function isSameAsVersion(version: Pick<Version, "title" | "content"> | null, title: string, content: PageContent): boolean {
  if (!version) return false;
  return version.title === title && contentFingerprint(version.content) === contentFingerprint(content);
}

/**
 * Whether an autosave should also record a Version: a Page with no history
 * gets a baseline immediately; after that, at most one per interval, and
 * never when nothing changed since the newest version.
 */
export function shouldSnapshot(latest: Version | null, title: string, content: PageContent, now: number): boolean {
  if (!latest) return true;
  if (isSameAsVersion(latest, title, content)) return false;
  return now - Date.parse(latest.createdAt) >= VERSION_SNAPSHOT_INTERVAL_MS;
}
