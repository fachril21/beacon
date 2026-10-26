"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PageTreeNode } from "@/lib/build-page-tree";
import type { Space } from "@/lib/types";

export type PublicSpaceValue = { space: Space; pages: PageTreeNode[] } | null;
export type PublicSpaceStatus = "loading" | "ready" | "not-found";

interface PublicSpaceContextValue {
  space: PublicSpaceValue;
  status: PublicSpaceStatus;
}

/**
 * The single Space the visitor is currently browsing on the public site, plus
 * only that Space's published page tree — resolved once by the (public)
 * layout shell (usePublicCurrentSpace) so the sidebar TOC, the Space landing
 * view, and the space-scoped search all read the same value instead of each
 * re-deriving it from whichever child route is mounted. Null on the Space
 * directory (org home), or while a slug is still resolving / matched nothing;
 * `status` keeps those two cases distinct so a resolving route shows a
 * skeleton instead of a false "not available" state.
 */
const PublicSpaceContext = createContext<PublicSpaceContextValue>({ space: null, status: "ready" });

export function PublicSpaceProvider({
  value,
  status = "ready",
  children,
}: {
  value: PublicSpaceValue;
  status?: PublicSpaceStatus;
  children: ReactNode;
}) {
  return <PublicSpaceContext.Provider value={{ space: value, status }}>{children}</PublicSpaceContext.Provider>;
}

export function usePublicSpace(): PublicSpaceValue {
  return useContext(PublicSpaceContext).space;
}

export function usePublicSpaceStatus(): PublicSpaceStatus {
  return useContext(PublicSpaceContext).status;
}
