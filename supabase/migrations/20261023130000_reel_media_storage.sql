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
