import { describe, it, expect } from "vitest";
import { findMentionQuery, applyMention, mentionedIdsInBody, segmentMentions } from "./mentions";

describe("findMentionQuery", () => {
  it("finds the query after an @ at the start or after whitespace", () => {
    expect(findMentionQuery("@Fa", 3)).toEqual({ query: "Fa", start: 0 });
    expect(findMentionQuery("halo @Fa", 8)).toEqual({ query: "Fa", start: 5 });
  });

  it("allows multi-word names so the list can narrow past the first space", () => {
    expect(findMentionQuery("tolong @Fachril Zul", 19)).toEqual({ query: "Fachril Zul", start: 7 });
  });

  it("returns null when there is no active mention at the cursor", () => {
    expect(findMentionQuery("halo dunia", 10)).toBeNull();
    expect(findMentionQuery("a@b.com", 7)).toBeNull(); // an email address is not a mention
    expect(findMentionQuery("@Fa halo\nbaris baru", 19)).toBeNull();
  });

  it("only looks at text before the cursor", () => {
    expect(findMentionQuery("@Fa dan sisanya", 3)).toEqual({ query: "Fa", start: 0 });
  });
});

describe("applyMention", () => {
  it("replaces the @query with the full name and a trailing space, and moves the cursor after it", () => {
    const result = applyMention("halo @Fa dan", 8, { query: "Fa", start: 5 }, "Fachril Zulfidar");
    expect(result.text).toBe("halo @Fachril Zulfidar  dan");
    expect(result.cursor).toBe("halo @Fachril Zulfidar ".length);
  });
});

describe("mentionedIdsInBody", () => {
  const picked = [
    { id: "u1", name: "Fachril Zulfidar" },
    { id: "u2", name: "Sari" },
  ];

  it("keeps only mentions whose @name is still in the text (deleting the text drops the notification)", () => {
    expect(mentionedIdsInBody("tolong cek @Fachril Zulfidar ya", picked)).toEqual(["u1"]);
    expect(mentionedIdsInBody("tolong cek ya", picked)).toEqual([]);
  });

  it("returns each id once, and does not match a longer name that merely starts the same", () => {
    expect(mentionedIdsInBody("@Sari dan @Sari", picked)).toEqual(["u2"]);
    expect(mentionedIdsInBody("@Sarimah", picked)).toEqual([]);
  });
});

describe("mentions of people shown by their full email", () => {
  const email = "sari.dewi@example.com";

  it("still opens the picker for a new @ typed after an inserted email mention", () => {
    const text = `cek @${email} dan @Bu`;
    expect(findMentionQuery(text, text.length)).toEqual({ query: "Bu", start: text.length - 3 });
  });

  it("keeps the person notified while their @email is in the text, and highlights all of it", () => {
    expect(mentionedIdsInBody(`halo @${email} ya`, [{ id: "u2", name: email }])).toEqual(["u2"]);
    expect(segmentMentions(`halo @${email} ya`, [email])).toEqual([
      { text: "halo ", isMention: false },
      { text: `@${email}`, isMention: true },
      { text: " ya", isMention: false },
    ]);
  });
});

describe("segmentMentions", () => {
  it("splits a body into plain and mention segments", () => {
    expect(segmentMentions("hai @Sari, tolong cek", ["Sari"])).toEqual([
      { text: "hai ", isMention: false },
      { text: "@Sari", isMention: true },
      { text: ", tolong cek", isMention: false },
    ]);
  });

  it("returns one plain segment when there is nothing to highlight", () => {
    expect(segmentMentions("tanpa mention", ["Sari"])).toEqual([{ text: "tanpa mention", isMention: false }]);
    expect(segmentMentions("@Sari", [])).toEqual([{ text: "@Sari", isMention: false }]);
  });

  it("prefers the longest matching name and escapes regex characters in names", () => {
    expect(segmentMentions("@Budi Santoso (QA)", ["Budi", "Budi Santoso (QA)"])).toEqual([{ text: "@Budi Santoso (QA)", isMention: true }]);
  });
});
