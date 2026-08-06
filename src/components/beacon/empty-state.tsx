import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: "default" | "secondary";
  tone?: "muted" | "destructive";
  className?: string;
}

/** DESIGN.md §7.1 (empty) / §7.3 (page-level error reuses the same composition). */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = "default",
  tone = "muted",
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-12 text-center", className)}>
      <Icon className={cn("size-12 stroke-[1.5]", tone === "destructive" ? "text-destructive" : "text-muted-foreground")} />
      <h3 className="text-h4 font-semibold text-foreground">{title}</h3>
      {description && <p className="max-w-sm text-body-sm text-muted-foreground">{description}</p>}
      {actionLabel && onAction && (
        <Button variant={actionVariant} onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
