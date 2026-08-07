-- Stage 3, Epic 16 (US16.2): "mentioning another User (@name) sends them a
-- real notification." No notification table/mechanism existed before this
-- migration (PROJECT.md §9.4 never listed one; the Comment.mentionedUserIds
-- array existed but nothing consumed it). Deliberately NOT built on Supabase
-- Realtime -- Epic 18 ("Real-time Collaboration") is explicitly Stage 4,
-- deferred. Delivery is a plain persisted row, read on demand by
-- use-notifications.ts's polling interval, which satisfies the "within 1
-- minute" AC without pulling in Realtime early.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  actor_user_id uuid not null references public.profiles (id),
  page_id uuid not null references public.pages (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_user_id, is_read, created_at desc);

alter table public.notifications enable row level security;

-- A User only ever sees their own notifications.
create policy notifications_select_own
  on public.notifications for select
  to authenticated
  using (recipient_user_id = auth.uid());

-- Created alongside a Comment insert, by the same commenter, gated by the
-- same Space-membership check comments_insert_member already enforces --
-- a notification can only be raised for a mention inside a comment the
-- actor was actually allowed to post.
create policy notifications_insert_by_commenter
  on public.notifications for insert
  to authenticated
  with check (
    actor_user_id = auth.uid()
    and public.user_space_role(public.page_space_id(page_id)) is not null
  );

-- A recipient can only mark their own notifications read (never anyone
-- else's, never any other field).
create policy notifications_update_own_mark_read
  on public.notifications for update
  to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

grant select, insert, update on public.notifications to authenticated, service_role;
