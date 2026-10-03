-- list_space_members() (20260930000000) returned profiles.name as-is, but that
-- column can be empty (it is not required at sign-up), so the @mention picker
-- showed a blank entry. Fall back to the part of the email before the "@" —
-- the same rule as src/lib/display-name.ts, so "@name" inserted into a comment
-- matches what the app later highlights.
--
-- Safe to run more than once. Run AFTER 20260930000000_list_space_members_rpc.sql.

create or replace function beacon.list_space_members(p_space_id uuid)
returns table (user_id uuid, name text, role text)
language sql
stable
security definer
set search_path = beacon, extensions
as $$
  select
    p.user_id,
    coalesce(nullif(btrim(pr.name), ''), nullif(split_part(pr.email, '@', 1), ''), 'Pengguna') as name,
    p.role
  from beacon.permissions p
  join beacon.profiles pr on pr.id = p.user_id
  where p.space_id = p_space_id
    and beacon.user_space_role(p_space_id) is not null
  order by 2;
$$;

revoke all on function beacon.list_space_members(uuid) from public, anon;
grant execute on function beacon.list_space_members(uuid) to authenticated, service_role;
