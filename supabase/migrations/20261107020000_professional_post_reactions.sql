-- Lightweight reactions for professional feed posts.
create table if not exists public.post_reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_reactions_user_created_idx
  on public.post_reactions (user_id, created_at desc);

alter table public.post_reactions enable row level security;
revoke all on table public.post_reactions from anon, authenticated;
grant select, insert, delete on table public.post_reactions to service_role;
