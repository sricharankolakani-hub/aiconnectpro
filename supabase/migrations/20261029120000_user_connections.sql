-- Private, server-mediated connection requests.
-- Profiles are undiscoverable by default; users opt in from Connections settings.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_discoverable_name_idx
  ON public.profiles (full_name)
  WHERE discoverable = true AND role = 'user';

CREATE TABLE IF NOT EXISTS public.connection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'disconnected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connection_requests_no_self CHECK (sender_id <> recipient_id)
);

-- Prevent duplicate or reciprocal pending requests and duplicate active connections.
CREATE UNIQUE INDEX IF NOT EXISTS connection_requests_one_active_pair_idx
  ON public.connection_requests (
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id)
  )
  WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS connection_requests_sender_status_created_idx
  ON public.connection_requests (sender_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS connection_requests_recipient_status_created_idx
  ON public.connection_requests (recipient_id, status, created_at DESC);

ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.connection_requests FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.connection_requests TO service_role;

COMMENT ON COLUMN public.profiles.discoverable IS
  'Whether this member opted into name-based discovery and connection requests.';
