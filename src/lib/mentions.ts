/**
 * @mention handling for comment text. Names may contain spaces, so the
 * query is everything between the `@` and the cursor (on one line), and the
 * mentions that count are decided from the final text, not from clicks.
 */

/** Longest `@query` offered to the picker; keeps a stray "@" in prose from matching a whole paragraph. */
const MAX_MENTION_QUERY_LENGTH = 40;

export interface MentionQuery {
  query: string;
  /** Index of the `@` in the text. */
  start: number;
}

export interface PickedMention {
  id: string;
  name: string;
}

/** The active `@query` just before the cursor, or null. An `@` inside a word (an email) is not a mention. */
export function findMentionQuery(text: string, cursor: number): MentionQuery | null {
  const upToCursor = text.slice(0, cursor);
  const match = upToCursor.match(new RegExp(`(?:^|\\s)@([^\\n@]{0,${MAX_MENTION_QUERY_LENGTH}})$`));
  if (!match) return null;
  const query = match[1];
  return { query, start: upToCursor.length - query.length - 1 };
}

/** Replaces the active `@query` with `@Name ` and reports where the cursor belongs afterwards. */
export function applyMention(text: string, cursor: number, mention: MentionQuery, name: string): { text: string; cursor: number } {
  const before = text.slice(0, mention.start);
  const inserted = `@${name} `;
  return { text: `${before}${inserted}${text.slice(cursor)}`, cursor: before.length + inserted.length };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `@name` followed by a non-letter/digit or the end, so "@Sari" does not match inside "@Sarimah". */
function mentionPattern(names: string[]): RegExp | null {
  if (names.length === 0) return null;
  const alternatives = [...names].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
  return new RegExp(`@(?:${alternatives})(?![\\p{L}\\p{N}])`, "gu");
}

/** Ids of the picked people whose `@name` is still in `body`, each once, in pick order. */
export function mentionedIdsInBody(body: string, picked: PickedMention[]): string[] {
  const ids: string[] = [];
  for (const { id, name } of picked) {
    if (ids.includes(id)) continue;
    const pattern = mentionPattern([name]);
    if (pattern && pattern.test(body)) ids.push(id);
  }
  return ids;
}

export interface BodySegment {
  text: string;
  isMention: boolean;
}

/** Splits a comment body into plain and `@mention` runs, for highlighting. */
export function segmentMentions(body: string, names: string[]): BodySegment[] {
  const pattern = mentionPattern(names);
  if (!pattern) return [{ text: body, isMention: false }];

  const segments: BodySegment[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ text: body.slice(lastIndex, index), isMention: false });
    segments.push({ text: match[0], isMention: true });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < body.length) segments.push({ text: body.slice(lastIndex), isMention: false });
  return segments.length > 0 ? segments : [{ text: body, isMention: false }];
}
