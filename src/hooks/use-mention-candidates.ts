"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePage } from "@/hooks/use-pages";
import { useSpacePermissions } from "@/hooks/use-spaces";
import { useUsers } from "@/hooks/use-users";
import { displayName } from "@/lib/display-name";
import type { User } from "@/lib/types";

/** The part of a User a mention needs. */
export type MentionCandidate = Pick<User, "id" | "name">;

interface SpaceMemberRow {
  user_id: string;
  name: string;
  role: string;
}

/** One RPC per Space, shared by every composer on the page (each screenshot block has one). */
const membersBySpace = new Map<string, Promise<MentionCandidate[]>>();

function loadSpaceMembers(spaceId: string): Promise<MentionCandidate[]> {
  const cached = membersBySpace.get(spaceId);
  if (cached) return cached;

  const request = (async () => {
    const { data, error } = await getSupabaseBrowserClient().rpc("list_space_members", { p_space_id: spaceId });
    if (error) throw error;
    return ((data ?? []) as SpaceMemberRow[]).map((row) => ({ id: row.user_id, name: displayName({ name: row.name }) }));
  })();
  // A failed lookup must not stick: the next composer retries.
  request.catch(() => membersBySpace.delete(spaceId));
  membersBySpace.set(spaceId, request);
  return request;
}

/** Forgets cached Space members (also used by tests). */
export function resetSpaceMembersCache(): void {
  membersBySpace.clear();
}

/**
 * Who a comment on this Page can @mention: members of the Page's Space,
 * because only they can open the Page the notification links to.
 *
 * Members come from the `list_space_members` RPC, not from the permissions
 * table: RLS lets only a Space admin read other people's permission rows, so
 * for an editor or viewer that table shows just themselves and the list came
 * out empty. If the RPC is unavailable (migration not applied) it falls back
 * to whatever permission rows the caller can read. The author is left out —
 * mentioning yourself notifies no one.
 */
export function useMentionCandidates(pageId: string | undefined, authorUserId: string | undefined): MentionCandidate[] {
  const page = usePage(pageId);
  const spaceId = page?.spaceId;
  const permissions = useSpacePermissions(spaceId);
  const users = useUsers();
  const [loaded, setLoaded] = useState<{ spaceId: string; members: MentionCandidate[] } | null>(null);
  const [failedSpaceId, setFailedSpaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!spaceId) return;
    let cancelled = false;
    loadSpaceMembers(spaceId).then(
      (members) => {
        if (!cancelled) setLoaded({ spaceId, members });
      },
      (error: unknown) => {
        console.error("[beacon] failed to load Space members for mentions:", error);
        if (!cancelled) setFailedSpaceId(spaceId);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  if (!spaceId) return [];

  let candidates: MentionCandidate[] = [];
  if (loaded?.spaceId === spaceId) {
    candidates = loaded.members;
  } else if (failedSpaceId === spaceId) {
    const memberIds = new Set(permissions.map((p) => p.userId));
    candidates = users.filter((u) => memberIds.has(u.id)).map((u) => ({ id: u.id, name: displayName(u) }));
  }
  return candidates.filter((c) => c.id !== authorUserId);
}
