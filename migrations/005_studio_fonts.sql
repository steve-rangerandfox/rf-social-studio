-- Migration 005: Cloud storage for user-uploaded custom fonts.
--
-- Custom fonts uploaded inside the Story Designer used to land in
-- localStorage as base64 data URLs — a single font easily ate 1 MB and
-- the 5–10 MB quota filled fast, surfacing "Browser storage is full."
-- They now live in a Supabase Storage bucket, keyed by Clerk user id,
-- so they survive across devices and don't compete with the studio
-- document for browser quota.
--
-- Each user's fonts are namespaced by their Clerk userId at the path
-- prefix: studio-fonts/{userId}/{fontId}.{ext}. All access goes through
-- the server-side API using the service_role key — anon clients are
-- denied. The bucket is `public` only for read so that the @font-face
-- url() the browser fetches doesn't need a signed URL per page load;
-- writes/deletes still require the server.
--
-- Run once against your Supabase project:
--   psql $DATABASE_URL < migrations/005_studio_fonts.sql

-- 1) Bucket -----------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'studio-fonts',
  'studio-fonts',
  TRUE,
  2 * 1024 * 1024,            -- 2 MB per font file
  ARRAY[
    'font/woff2',
    'font/woff',
    'font/ttf',
    'font/otf',
    'application/font-woff',
    'application/font-woff2',
    'application/x-font-ttf',
    'application/x-font-otf',
    'application/octet-stream'  -- some browsers send this for .otf/.ttf
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) RLS policies -----------------------------------------------------
-- Service role: full access (the only way the server writes).
DROP POLICY IF EXISTS "Service role full access to studio-fonts" ON storage.objects;
CREATE POLICY "Service role full access to studio-fonts"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'studio-fonts')
  WITH CHECK (bucket_id = 'studio-fonts');

-- Public read: so the browser can fetch the binary for @font-face url().
DROP POLICY IF EXISTS "Public read of studio-fonts" ON storage.objects;
CREATE POLICY "Public read of studio-fonts"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'studio-fonts');

-- Anon writes/deletes: explicitly denied. Service role bypasses RLS, so
-- this is belt-and-suspenders for the anon key.
DROP POLICY IF EXISTS "Deny anon writes to studio-fonts" ON storage.objects;
CREATE POLICY "Deny anon writes to studio-fonts"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS "Deny anon deletes from studio-fonts" ON storage.objects;
CREATE POLICY "Deny anon deletes from studio-fonts"
  ON storage.objects FOR DELETE
  TO anon
  USING (FALSE);
