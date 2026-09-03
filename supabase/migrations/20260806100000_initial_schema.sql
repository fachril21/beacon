-- Beacon initial schema — matches src/lib/types.ts field-for-field (PRD.md
-- Epic 9 / US9.1). Every entity from PROJECT.md §9.4 gets a table here, even
-- ones whose hook-wiring is deferred to Stage 3 (Comment, Feedback), so the
-- schema is reviewed as one coherent unit rather than added to piecemeal.

-- pgcrypto is provisioned in 20260806090000_create_beacon_schema.sql (into the
-- shared `extensions` schema); this line is a no-op safety net if that ran
-- against a different database.
create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- Organization
-- ---------------------------------------------------------------------------

create table beacon.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text unique,
  is_domain_verified boolean not null default false,
  pending_dns_token text,
  created_at timestamptz not null default now()
);

comment on table beacon.organizations is
  'One independently-branded public domain (PRD.md §5.3a). Publicly readable — domain names are not sensitive.';

-- ---------------------------------------------------------------------------
-- profiles — app-facing fields for auth.users (PROJECT.md §9.4)
-- ---------------------------------------------------------------------------

create table beacon.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null default '',
  avatar_url text,
  organization_id uuid not null references beacon.organizations (id),
  organization_role text not null default 'member'
    check (organization_role in ('owner', 'member')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Space
-- ---------------------------------------------------------------------------

create table beacon.spaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references beacon.organizations (id) on delete cascade,
  name text not null,
  category text,
  is_publishable boolean not null default false,
  created_by_user_id uuid not null references beacon.profiles (id),
  created_at timestamptz not null default now()
);

create index spaces_organization_id_idx on beacon.spaces (organization_id);

-- ---------------------------------------------------------------------------
-- Permission — Space-scoped role (PROJECT.md §9.4)
-- ---------------------------------------------------------------------------

create table beacon.permissions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references beacon.spaces (id) on delete cascade,
  user_id uuid not null references beacon.profiles (id) on delete cascade,
  role text not null check (role in ('viewer', 'editor', 'admin')),
  unique (space_id, user_id)
);

create index permissions_user_id_idx on beacon.permissions (user_id);
create index permissions_space_id_idx on beacon.permissions (space_id);

create table beacon.pending_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references beacon.spaces (id) on delete cascade,
  email text not null,
  role text not null check (role in ('viewer', 'editor', 'admin')),
  invited_by_user_id uuid not null references beacon.profiles (id),
  created_at timestamptz not null default now()
);

create index pending_invites_space_id_idx on beacon.pending_invites (space_id);

-- ---------------------------------------------------------------------------
-- Page
-- ---------------------------------------------------------------------------

create table beacon.pages (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references beacon.spaces (id) on delete cascade,
  parent_page_id uuid references beacon.pages (id) on delete cascade,
  title text not null default '',
  "order" integer not null default 0,
  content jsonb not null default '{}'::jsonb,
  visibility text not null default 'internal'
    check (visibility in ('internal', 'publishable')),
  is_published boolean not null default false,
  published_content_snapshot jsonb,
  published_at timestamptz,
  created_by_user_id uuid not null references beacon.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pages_space_id_idx on beacon.pages (space_id);
create index pages_parent_page_id_idx on beacon.pages (parent_page_id);
-- Public-read path filters on exactly this pair (PRD.md §5.3 truth source).
create index pages_publishable_published_idx on beacon.pages (visibility, is_published)
  where visibility = 'publishable' and is_published = true;

-- ---------------------------------------------------------------------------
-- ScreenshotBlock — the one Block subtype that is a first-class row
-- (src/lib/types.ts's "Stage 1 modeling note": ordinary blocks live inside
-- Page.content as native Lexical nodes; only ScreenshotBlock needs a stable,
-- independently addressable id).
-- ---------------------------------------------------------------------------

create table beacon.screenshot_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references beacon.pages (id) on delete cascade,
  "order" integer not null default 0,
  -- S3/MinIO object key (PRD.md §5.2) — not a URL; the app derives a
  -- fetchable URL at read time (public bucket policy or a signed GET).
  image_object_key text not null,
  image_width integer not null,
  image_height integer not null,
  annotation_json jsonb,
  description text not null default '',
  alt_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index screenshot_blocks_page_id_idx on beacon.screenshot_blocks (page_id);

-- ---------------------------------------------------------------------------
-- Version
-- ---------------------------------------------------------------------------

create table beacon.versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references beacon.pages (id) on delete cascade,
  title text not null,
  content jsonb not null,
  created_by_user_id uuid not null references beacon.profiles (id),
  created_at timestamptz not null default now(),
  is_restore_of uuid references beacon.versions (id)
);

create index versions_page_id_idx on beacon.versions (page_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Comment (Stage 3 wiring, Epic 16 — schema included now per Epic 9 AC)
-- ---------------------------------------------------------------------------

create table beacon.comments (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references beacon.pages (id) on delete cascade,
  -- References either a screenshot_blocks.id or a Lexical node's
  -- beaconBlockId attribute (src/lib/types.ts) — not a strict FK.
  block_id text not null,
  author_user_id uuid not null references beacon.profiles (id),
  body text not null,
  mentioned_user_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index comments_page_id_idx on beacon.comments (page_id, block_id);

-- ---------------------------------------------------------------------------
-- Feedback (Stage 3 wiring, Epic 15 — schema included now per Epic 9 AC)
-- ---------------------------------------------------------------------------

create table beacon.feedback (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references beacon.pages (id) on delete cascade,
  helpful boolean not null,
  comment text,
  created_at timestamptz not null default now()
);

create index feedback_page_id_idx on beacon.feedback (page_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create function beacon.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pages_set_updated_at
  before update on beacon.pages
  for each row execute function beacon.set_updated_at();

create trigger screenshot_blocks_set_updated_at
  before update on beacon.screenshot_blocks
  for each row execute function beacon.set_updated_at();
