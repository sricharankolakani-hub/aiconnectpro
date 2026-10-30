-- Private media storage for Reels.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reel-media',
  'reel-media',
  false,
  26214400,
  ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users upload reel media to their own folder" ON storage.objects;
CREATE POLICY "Users upload reel media to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reel-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users read their own reel media" ON storage.objects;
CREATE POLICY "Users read their own reel media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'reel-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- The API uses service_role to issue short-lived URLs after enforcing reel visibility.

CREATE TABLE IF NOT EXISTS public.reel_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reel_shares_reel_id_idx ON public.reel_shares (reel_id);
CREATE INDEX IF NOT EXISTS reel_comments_reel_created_idx ON public.reel_comments (reel_id, created_at DESC);

ALTER TABLE public.reel_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.reel_shares FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.reel_shares TO service_role;
