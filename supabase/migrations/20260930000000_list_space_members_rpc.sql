-- Comment @mentions need "who is in this Space". permissions_select_admin_or_self
-- (20260806100100_rls_policies.sql) lets only a Space admin read other people's
-- permission rows, so for an editor or viewer the permissions table shows just
-- their own row and the mention picker came out empty.
--
-- This SECURITY DEFINER function returns the member list to any caller who is
-- themselves a member of that Space (user_space_role also requires Organization
-- membership), and nothing to anyone else. It exposes only user id, display
-- name and role — no emails.
--
-- Safe to run more than once. Paste into the Supabase SQL editor as-is.

create or replace function beacon.list_space_members(p_space_id uuid)
returns table (user_id uuid, name text, role text)
language sql
stable
security definer
set search_path = beacon, extensions
as $$
  select p.user_id, pr.name, p.role
  from beacon.permissions p
  join beacon.profiles pr on pr.id = p.user_id
  where p.space_id = p_space_id
    and beacon.user_space_role(p_space_id) is not null
  order by pr.name;
$$;

revoke all on function beacon.list_space_members(uuid) from public, anon;
grant execute on function beacon.list_space_members(uuid) to authenticated, service_role;
