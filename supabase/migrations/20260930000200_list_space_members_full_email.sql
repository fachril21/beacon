-- list_space_members() (20260930000100) fell back to the part of the email
-- before the "@" when a profile has no name. Show the full email instead, the
-- same rule as src/lib/display-name.ts, so "@name" inserted into a comment
-- matches what the app later highlights.
--
-- Safe to run more than once. Run AFTER 20260930000000 and 20260930000100
-- (or instead of 20260930000100 if you have not run it yet).

create or replace function beacon.list_space_members(p_space_id uuid)
returns table (user_id uuid, name text, role text)
language sql
stable
security definer
set search_path = beacon, extensions
as $$
  select
    p.user_id,
    coalesce(nullif(btrim(pr.name), ''), nullif(btrim(pr.email), ''), 'Pengguna') as name,
    p.role
  from beacon.permissions p
  join beacon.profiles pr on pr.id = p.user_id
  where p.space_id = p_space_id
    and beacon.user_space_role(p_space_id) is not null
  order by 2;
$$;

revoke all on function beacon.list_space_members(uuid) from public, anon;
grant execute on function beacon.list_space_members(uuid) to authenticated, service_role;
