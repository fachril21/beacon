-- Stage 3, Epic 15 (US15.1): "Feedback rows... rate-limited per IP." The PRD's
-- architecture note (PROJECT.md) frames this as a Supabase Edge Function, but
-- deploying one wasn't practical this session: the linked `supabase` CLI
-- account doesn't have this project (`supabase projects list` doesn't show
-- it), so `supabase functions deploy` has nowhere to push to. Implemented as
-- an equivalent Postgres-level throttle instead — a tracking table plus a
-- SECURITY DEFINER function called from the existing INSERT RLS policy's
-- `with check`, so the limit is still a database-layer guarantee, not a
-- client-trusted one. This is a deliberate architecture substitution, not a
-- silent scope cut — see docs/testing/stage-3-engagement.tdd.md.

create table public.feedback_rate_limits (
  page_id uuid not null references public.pages (id) on delete cascade,
  ip_address inet not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (page_id, ip_address, window_start)
);

-- Reads the caller's IP from the request headers PostgREST exposes to RLS
-- (`x-forwarded-for`, set by Supabase's own edge proxy on the hosted
-- platform -- not a header an anonymous client can spoof past that proxy).
-- Falls back to "allow" when no HTTP header context exists (e.g. a direct
-- psql/seed-script insert), so this never blocks non-HTTP paths.
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
    v_ip := nullif(current_setting('request.headers', true)::json ->> 'x-forwarded-for', '')::inet;
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

drop policy if exists feedback_insert_public_on_published on public.feedback;

create policy feedback_insert_public_on_published
  on public.feedback for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.pages p
      join public.spaces s on s.id = p.space_id
      where p.id = feedback.page_id
        and p.is_published = true
        and p.visibility = 'publishable'
        and s.is_publishable = true
    )
    and public.feedback_rate_limit_ok(feedback.page_id)
  );

grant select, insert on public.feedback_rate_limits to anon, authenticated, service_role;
