-- Persistent member updates for the signed-in professional feed.
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'update'
    check (type in ('update', 'milestone', 'business', 'learning')),
  title text not null default ''
    check (char_length(title) <= 160),
  body text not null
    check (char_length(body) between 1 and 3000),
  visibility text not null default 'private'
    check (visibility in ('private', 'connections')),
  created_at timestamptz not null default now()
);

create index if not exists posts_author_created_idx
  on public.posts (author_id, created_at desc);

create index if not exists posts_connection_author_created_idx
  on public.posts (author_id, created_at desc)
  where visibility = 'connections';

alter table public.posts enable row level security;
revoke all on table public.posts from anon, authenticated;
grant select, insert, update, delete on table public.posts to service_role;
