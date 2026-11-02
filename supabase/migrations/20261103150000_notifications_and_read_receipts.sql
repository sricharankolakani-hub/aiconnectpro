-- In-app notifications for connection requests and decisions, plus message read receipts.
alter table public.direct_messages
  add column if not exists read_at timestamptz;

create index if not exists direct_messages_unread_conversation_idx
  on public.direct_messages (conversation_id, read_at)
  where read_at is null;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('connection_request', 'connection_accepted', 'connection_declined')),
  request_id uuid not null references public.connection_requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_unique_request_event unique (user_id, type, request_id)
);

create index if not exists notifications_unread_user_created_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, insert, update, delete on public.notifications to service_role;
