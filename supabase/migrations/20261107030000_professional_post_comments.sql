-- Comments for private and connection-only professional feed posts.
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1500),
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_created_idx
  on public.post_comments (post_id, created_at desc);
create index if not exists post_comments_user_created_idx
  on public.post_comments (user_id, created_at desc);

alter table public.post_comments enable row level security;
revoke all on table public.post_comments from anon, authenticated;
grant select, insert, delete on table public.post_comments to service_role;
