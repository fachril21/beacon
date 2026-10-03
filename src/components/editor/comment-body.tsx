"use client";

import { useUsers } from "@/hooks/use-users";
import { displayName } from "@/lib/display-name";
import { segmentMentions } from "@/lib/mentions";
import type { Comment } from "@/lib/types";

/** A comment's text with the people it @mentions highlighted. */
export function CommentBody({ comment }: { comment: Comment }) {
  const users = useUsers();
  const names = comment.mentionedUserIds.flatMap((id) => {
    const user = users.find((u) => u.id === id);
    return user ? [displayName(user)] : [];
  });

  return (
    <p className="text-body-sm whitespace-pre-wrap text-foreground">
      {segmentMentions(comment.body, names).map((segment, index) =>
        segment.isMention ? (
          <span key={index} data-mention="true" className="rounded-sm bg-primary/15 px-0.5 font-medium text-primary">
            {segment.text}
          </span>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </p>
  );
}
