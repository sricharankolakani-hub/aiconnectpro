-- Notify the requester when an administrator approves or rejects company access.
alter table public.notifications
  add column company_access_request_id uuid
  references public.company_access_requests(id) on delete cascade;

alter table public.notifications
  drop constraint notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'connection_request',
    'connection_accepted',
    'connection_declined',
    'job_application',
    'company_request_approved',
    'company_request_rejected'
  ));

alter table public.notifications
  add constraint notifications_unique_company_request_event
  unique (user_id, company_access_request_id);
