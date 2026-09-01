"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PageTreeNode } from "@/lib/build-page-tree";
import type { Space } from "@/lib/types";

export type PublicSpaceValue = { space: Space; pages: PageTreeNode[] } | null;

/**
 * The single Space the visitor is currently browsing on the public site, plus
 * only that Space's published page tree — resolved once by the (public)
 * layout shell (usePublicCurrentSpace) so the sidebar TOC, the Space landing
 * view, and the space-scoped search all read the same value instead of each
 * re-deriving it from whichever child route is mounted. Null on the Space
 * directory (org home), or while a slug is still resolving / matched nothing.
 */
const PublicSpaceContext = createContext<PublicSpaceValue>(null);

export function PublicSpaceProvider({ value, children }: { value: PublicSpaceValue; children: ReactNode }) {
  return <PublicSpaceContext.Provider value={value}>{children}</PublicSpaceContext.Provider>;
}

export function usePublicSpace(): PublicSpaceValue {
  return useContext(PublicSpaceContext);
}
