-- Private one-to-one messages are accessible only through the authenticated API.
create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  member_a uuid not null references auth.users(id) on delete cascade,
  member_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint direct_conversations_distinct_members check (member_a < member_b),
  constraint direct_conversations_unique_pair unique (member_a, member_b)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at desc);

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

-- The server uses its private service-role key and performs participant and
-- accepted-connection checks on every request. Browser clients get no table access.
revoke all on public.direct_conversations, public.direct_messages from anon, authenticated;
grant all on public.direct_conversations, public.direct_messages to service_role;
