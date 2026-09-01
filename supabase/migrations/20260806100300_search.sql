-- Full-text search (PRD.md Epic 14, §5.5) — 'simple' config since Postgres's
-- built-in dictionaries have no Bahasa Indonesia stemming (PRD.md
-- Localization: "Bahasa Indonesia only for v1"); 'simple' tokenizes without
-- stemming, which is a safe language-agnostic default rather than silently
-- using English stemming rules on Indonesian text.
--
-- content is Lexical's JSONB tree, not plain text, so extracting searchable
-- text from it in SQL would mean walking an arbitrary JSON tree in PL/pgSQL.
-- Instead, search_text is a denormalized plain-text column the app keeps in
-- sync (src/lib/extract-text.ts's extractPlainText, already used client-side
-- for Stage 1's mock search) whenever it writes page content.

alter table beacon.pages add column search_text text not null default '';

alter table beacon.pages add column search_vector tsvector
  generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(search_text, ''))
  ) stored;

create index pages_search_vector_idx on beacon.pages using gin (search_vector);
