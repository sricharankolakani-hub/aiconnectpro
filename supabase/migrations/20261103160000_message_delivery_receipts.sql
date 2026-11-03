-- Track when a recipient's authenticated inbox first retrieves a message.
alter table public.direct_messages
  add column if not exists delivered_at timestamptz;

create index if not exists direct_messages_undelivered_conversation_idx
  on public.direct_messages (conversation_id, delivered_at)
  where delivered_at is null;
