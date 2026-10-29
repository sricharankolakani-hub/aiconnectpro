-- Sensitive profile details are private by default and readable only by the
-- account owner. Do not expose DOB, location, or bio through public profile APIs.
create table if not exists public.profile_private_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  date_of_birth date,
  location text not null default '',
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profile_private_details enable row level security;
revoke all on public.profile_private_details from anon, authenticated;

create policy "Members read their own private profile details"
on public.profile_private_details
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Members create their own private profile details"
on public.profile_private_details
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Members update their own private profile details"
on public.profile_private_details
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Members delete their own private profile details"
on public.profile_private_details
for delete
to authenticated
using ((select auth.uid()) = user_id);
