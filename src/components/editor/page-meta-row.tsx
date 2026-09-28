"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/hooks/use-users";
import { useHelpfulnessRate } from "@/hooks/use-feedback";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { Page } from "@/lib/types";

/**
 * Meta line under the editor title: author avatar + "{nama} · diubah {relatif}",
 * then the aggregate helpfulness rate (US15.2). The rate is editor/admin-only
 * (mirrors the feedback_select_editor RLS policy) and only fetched for a
 * published Page — a viewer never even issues the query.
 */
export function PageMetaRow({ page, canEdit }: { page: Page; canEdit: boolean }) {
  const author = useUser(page.createdByUserId);
  const helpfulness = useHelpfulnessRate(canEdit && page.isPublished ? page.id : undefined);
  const edited = formatRelativeTime(page.updatedAt).toLowerCase();

  return (
    <div className="flex flex-wrap items-center gap-2.5 text-body-sm text-muted-foreground">
      <Avatar className="size-[22px]">
        <AvatarImage src={author?.avatarUrl ?? undefined} alt="" />
        <AvatarFallback className="text-[9px]">{author?.name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
      </Avatar>
      <span>{author?.name ? `${author.name} · diubah ${edited}` : `Diubah ${edited}`}</span>
      {canEdit && helpfulness.total > 0 && (
        <>
          <span aria-hidden className="text-border">
            |
          </span>
          <span>
            {helpfulness.total} respons · {Math.round((helpfulness.rate ?? 0) * 100)}% membantu
          </span>
        </>
      )}
    </div>
  );
}
