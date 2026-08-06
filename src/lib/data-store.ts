/**
 * Internal Stage 1 data store — seeds reactive Store<T> instances from the
 * mock fixtures. Only src/hooks/*.ts may import this file; components must
 * go through hooks (PRD.md Epic 1 US1.3). Stage 2 deletes this file entirely
 * once hooks call Supabase directly.
 */
import { createStore } from "@/lib/store";
import type { Organization, User, Space, Permission, PendingInvite, Page, ScreenshotBlock, Version, Comment, Feedback } from "@/lib/types";
import {
  mockOrganizations,
  mockUsers,
  mockSpaces,
  mockPermissions,
  mockPendingInvites,
  mockPages,
  mockScreenshotBlocks,
  mockVersions,
  mockComments,
  mockFeedback,
} from "@/lib/mock";

export const organizationsStore = createStore<Organization[]>(mockOrganizations);
export const usersStore = createStore<User[]>(mockUsers);
export const spacesStore = createStore<Space[]>(mockSpaces);
export const permissionsStore = createStore<Permission[]>(mockPermissions);
export const pendingInvitesStore = createStore<PendingInvite[]>(mockPendingInvites);
export const pagesStore = createStore<Page[]>(mockPages);
export const screenshotBlocksStore = createStore<Record<string, ScreenshotBlock>>(mockScreenshotBlocks);
export const versionsStore = createStore<Version[]>(mockVersions);
export const commentsStore = createStore<Comment[]>(mockComments);
export const feedbackStore = createStore<Feedback[]>(mockFeedback);

let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}
