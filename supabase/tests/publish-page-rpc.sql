-- Regression test for "failed to publish" (see
-- 20260929000000_fix_publish_slug_generation.sql). Same harness as
-- space-creation-rls.sql: run in a local Supabase Postgres; everything rolls
-- back. Expected results are annotated inline.

\set ON_ERROR_STOP off
begin;

-- slugify must work under the exact search_path publish_page uses.
set local search_path = beacon, extensions;
select beacon.slugify('Panduan Pengguna Ünïcode') as expect_panduan_pengguna_unicode;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('a0000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-000000000000','authenticated','authenticated','editor@example.com', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-000000000000','authenticated','authenticated','outsider@example.com', crypt('x', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '');

insert into beacon.organizations (id, name) values ('90000000-0000-0000-0000-000000000009', 'Publish Test Org');
insert into beacon.organization_memberships (organization_id, user_id, role)
values ('90000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-00000000000a', 'owner');
insert into beacon.spaces (id, organization_id, name, is_publishable, created_by_user_id)
values ('b0000000-0000-0000-0000-00000000000b', '90000000-0000-0000-0000-000000000009', 'Docs', true, 'a0000000-0000-0000-0000-00000000000a');
insert into beacon.permissions (space_id, user_id, role)
values ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'admin');
insert into beacon.pages (id, space_id, title, "order", content, created_by_user_id)
values ('c0000000-0000-0000-0000-00000000000c', 'b0000000-0000-0000-0000-00000000000b', 'Getting Started', 0, '[]', 'a0000000-0000-0000-0000-00000000000a');

-- Editor: first publish assigns a slug. EXPECT: is_published=t, slug='getting-started'.
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;
select is_published, slug from beacon.publish_page('c0000000-0000-0000-0000-00000000000c');

-- Republish keeps the slug. EXPECT: slug='getting-started'.
select slug from beacon.update_published_page('c0000000-0000-0000-0000-00000000000c');

-- Outsider (no Permission on the Space): EXPECT error 42501, NOT an all-null row.
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-00000000000b', 'role', 'authenticated')::text, true);
select * from beacon.publish_page('c0000000-0000-0000-0000-00000000000c');

rollback;
