"use client";

import { createContext, useContext } from "react";

const PageIdContext = createContext<string | null>(null);

export function PageIdProvider({ pageId, children }: { pageId: string; children: React.ReactNode }) {
  return <PageIdContext.Provider value={pageId}>{children}</PageIdContext.Provider>;
}

export function usePageId(): string {
  const pageId = useContext(PageIdContext);
  if (!pageId) throw new Error("usePageId must be used within a PageIdProvider");
  return pageId;
}
