-- Epic 14a follow-up: rate limits the "Verify" action on Organization Domain
-- Settings (Flow 7a) so a scripted retry loop can't hammer DNS lookups or
-- the organizations table. Mirrors the feedback_rate_limit_ok pattern
-- (20260807000000_feedback_rate_limit.sql) but keyed on the authenticated
-- caller's Organization rather than an anon IP, since this action requires
-- a signed-in owner.

create table beacon.domain_verification_attempts (
  organization_id uuid not null references beacon.organizations (id) on delete cascade,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (organization_id, window_start)
);

alter table beacon.domain_verification_attempts enable row level security;

create function beacon.check_domain_verification_rate_limit(
  p_organization_id uuid,
  p_max_per_window int default 5,
  p_window_minutes int default 10
)
returns boolean
language plpgsql
security definer
set search_path = beacon, extensions
as $$
declare
  v_window_start timestamptz;
  v_count int;
begin
  if p_organization_id is distinct from beacon.current_profile_organization_id() then
    return false;
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / (p_window_minutes * 60)) * (p_window_minutes * 60));

  insert into beacon.domain_verification_attempts (organization_id, window_start, count)
  values (p_organization_id, v_window_start, 1)
  on conflict (organization_id, window_start)
  do update set count = domain_verification_attempts.count + 1
  returning count into v_count;

  return v_count <= p_max_per_window;
end;
$$;

grant execute on function beacon.check_domain_verification_rate_limit(uuid, int, int) to authenticated;
