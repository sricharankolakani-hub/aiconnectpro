-- Private employer access request queue. All reads/writes go through the trusted backend service role.
CREATE TABLE IF NOT EXISTS public.company_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL CHECK (char_length(company_name) BETWEEN 2 AND 160),
  website text CHECK (website IS NULL OR char_length(website) <= 320),
  message text CHECK (message IS NULL OR char_length(message) <= 1500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS company_access_requests_one_pending_per_user
  ON public.company_access_requests (requester_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS company_access_requests_status_created_at
  ON public.company_access_requests (status, created_at DESC);

ALTER TABLE public.company_access_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.company_access_requests FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.company_access_requests TO service_role;
