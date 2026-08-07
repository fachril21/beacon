-- Fixes a real bug found by live E2E testing against the deployed
-- 20260807000000_feedback_rate_limit.sql function: calling
-- feedback_rate_limit_ok 5x in a row from the same machine within seconds
-- returned `true` every time (should have rejected calls 4-5, limit is 3).
-- `feedback_rate_limits` showed 5 rows for 5 DIFFERENT ip_address values for
-- the same real page_id -- `x-forwarded-for` is a comma-separated hop chain
-- (client, proxy1, proxy2, ...) on this hosting setup, and casting the
-- entire raw string straight to `inet` only "succeeds" when it happens to
-- parse as a single address, silently keying each request under whatever
-- the last/only parseable hop was instead of the actual client. The
-- standard fix -- and what was missing here -- is to take the FIRST
-- comma-separated segment (the original client, per the X-Forwarded-For
-- convention every hop appends to, never overwrites).

create or replace function public.feedback_rate_limit_ok(
  p_page_id uuid,
  p_max_per_window int default 3,
  p_window_minutes int default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip inet;
  v_window_start timestamptz;
  v_count int;
begin
  begin
    v_ip := nullif(
      trim(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1)),
      ''
    )::inet;
  exception when others then
    v_ip := null;
  end;

  if v_ip is null then
    return true;
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / (p_window_minutes * 60)) * (p_window_minutes * 60));

  insert into public.feedback_rate_limits (page_id, ip_address, window_start, count)
  values (p_page_id, v_ip, v_window_start, 1)
  on conflict (page_id, ip_address, window_start)
  do update set count = feedback_rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_max_per_window;
end;
$$;
