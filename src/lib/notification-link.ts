/** Where a mention notification leads: its page, with the tagging comment in the query so the page can open it. */
export function notificationHref(page: { spaceId: string; pageId: string } | undefined, commentId: string): string | null {
  if (!page) return null;
  return `/spaces/${page.spaceId}/pages/${page.pageId}?comment=${encodeURIComponent(commentId)}`;
}

/** A comment's text on one line, cut to `maxLength` characters with an ellipsis. */
export function commentSnippet(body: string | null | undefined, maxLength = 80): string {
  const text = (body ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
