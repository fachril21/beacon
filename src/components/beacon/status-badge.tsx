import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type PageStatus = "draft" | "published" | "pending" | "archived";

const LABELS: Record<PageStatus, string> = {
  draft: "Draf",
  published: "Dipublikasikan",
  pending: "Menunggu",
  archived: "Tidak dipublikasikan",
};

/** Leading dot uses the badge's un-muted counterpart color (DESIGN.md §5.5). */
const DOT_CLASS: Record<PageStatus, string> = {
  draft: "bg-muted-foreground",
  published: "bg-primary",
  pending: "bg-warning",
  archived: "bg-muted-foreground",
};

export function StatusBadge({ status, className }: { status: PageStatus; className?: string }) {
  const showDot = status === "published" || status === "pending";
  return (
    <Badge variant={status} className={cn("gap-1.5", className)}>
      {showDot && <span className={cn("size-1 rounded-full", DOT_CLASS[status])} />}
      {LABELS[status]}
    </Badge>
  );
}
