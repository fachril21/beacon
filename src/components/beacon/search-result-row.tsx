import { FileText } from "lucide-react";
import type { SearchResult } from "@/lib/types";

/** Shared row shape for both internal (Epic 8) and public (Epic 7) search — breadcrumb + title + snippet. */
export function SearchResultRow({ result }: { result: SearchResult }) {
  return (
    <div className="flex items-center gap-2">
      <FileText className="size-3.5 text-muted-foreground" />
      <span className="text-caption text-muted-foreground">{result.spaceName}</span>
      <span className="text-caption text-muted-foreground">/</span>
      <span className="text-body-sm text-foreground">{result.pageTitle}</span>
    </div>
  );
}
