-- =============================================================================
--  Linter 0025 (public_bucket_allows_listing).
--
--  documents-and-images, media-posts and profile-pictures are public buckets
--  that each also carry a broad SELECT policy on storage.objects. For a PUBLIC
--  bucket, fetching an object by its URL does not consult RLS at all — so that
--  policy buys nothing for display, while allowing any caller to enumerate
--  every file in the bucket (including filenames of client documents).
--
--  Verified before dropping: the app never calls storage.list(). The only
--  storage calls in src/ are getPublicUrl (Team.tsx:115, UpdatesTab.tsx:366),
--  upload and remove (lib/api/projectApi.ts:652,666). INSERT/DELETE policies
--  are untouched, so upload and remove keep working.
--
--  If an image somewhere does go blank after this, the cause is a code path
--  using download()/list() on a public bucket rather than getPublicUrl — the
--  fix is to switch that call, not to restore blanket listing.
-- =============================================================================

DROP POLICY IF EXISTS "Allow public download from documents-and-images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view media files"                     ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile pictures"                ON storage.objects;
