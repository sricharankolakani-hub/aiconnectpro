-- Notify active members of verified organizations when an applicant applies.
-- Keep connection notifications compatible by making request_id optional.
alter table public.notifications
  alter column request_id drop not null;

alter table public.notifications
  add column application_id uuid references public.applications(id) on delete cascade;

alter table public.notifications
  drop constraint notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('connection_request', 'connection_accepted', 'connection_declined', 'job_application'));

alter table public.notifications
  add constraint notifications_unique_application_event
  unique (user_id, application_id);
