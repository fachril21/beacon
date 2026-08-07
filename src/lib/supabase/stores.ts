/**
 * One CollectionStore per Supabase table backing a Stage 2 hook. Only
 * src/hooks/*.ts may import this file — components must go through hooks
 * (PRD.md Epic 1 US1.3), same rule Stage 1's data-store.ts enforced.
 */
import { createCollectionStore } from "./collection-store";
import type {
  Organization,
  Space,
  Page,
  Permission,
  PendingInvite,
  Version,
  User,
  ScreenshotBlock,
  Comment,
  Feedback,
} from "@/lib/types";

export const organizationsStore = createCollectionStore<Organization>();
export const usersStore = createCollectionStore<User>();
export const spacesStore = createCollectionStore<Space>();
export const pagesStore = createCollectionStore<Page>();
export const permissionsStore = createCollectionStore<Permission>();
export const pendingInvitesStore = createCollectionStore<PendingInvite>();
export const versionsStore = createCollectionStore<Version>();
export const screenshotBlocksStore = createCollectionStore<ScreenshotBlock>();
export const commentsStore = createCollectionStore<Comment>();
export const feedbackStore = createCollectionStore<Feedback>();
