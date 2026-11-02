-- Member-submitted reports for Reels and profiles.
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('reel', 'member')),
  target_reel_id uuid REFERENCES public.reels(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate_or_abuse', 'misleading', 'unsafe', 'other')),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (target_type = 'reel' AND target_reel_id IS NOT NULL)
    OR (target_type = 'member' AND target_user_id IS NOT NULL)
  ),
  CHECK (target_user_id IS NULL OR target_user_id <> reporter_id)
);

CREATE INDEX IF NOT EXISTS content_reports_status_created_idx
  ON public.content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_reporter_created_idx
  ON public.content_reports (reporter_id, created_at DESC);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.content_reports FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_reports TO service_role;
