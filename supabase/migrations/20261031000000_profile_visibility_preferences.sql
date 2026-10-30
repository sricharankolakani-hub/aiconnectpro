-- Visibility preferences default to private, including contact details and photo.
alter table public.profile_private_details
  add column if not exists visibility jsonb not null default
    '{"date_of_birth":"private","location":"private","bio":"private","email":"private","phone":"private","avatar":"private"}'::jsonb;

update public.profile_private_details
set visibility = '{"date_of_birth":"private","location":"private","bio":"private","email":"private","phone":"private","avatar":"private"}'::jsonb
where visibility is null;
