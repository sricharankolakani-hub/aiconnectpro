-- Add a third audience for Capsules while keeping every existing post's audience intact.
-- Legacy NULL visibility is treated as private so no member's post becomes public by default.
update public.reels set visibility = 'private' where visibility is null;

alter table public.reels
  alter column visibility set default 'private',
  alter column visibility set not null;

alter table public.reels
  add constraint reels_visibility_allowed_check
  check (visibility in ('private', 'connections', 'public'));
