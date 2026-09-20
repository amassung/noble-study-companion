-- ── Nobi: make slide storage private ────────────────────────────────────────
-- The slides bucket was created public, so every uploaded lecture page was
-- readable by anyone holding its URL. The paths contain uuids and are not
-- guessable, but that is obscurity rather than access control, and what goes
-- in here is other people's copyrighted course material — and, for a nursing
-- student, slides that can carry patient case detail.
--
-- Turning the bucket private makes the stored public URLs stop resolving, so
-- the client signs a short-lived URL per slide at display time instead. Object
-- paths are unchanged: `{user_id}/{note_id}/{import_id}-{page}.jpg`, with the
-- first segment matching auth.uid().

update storage.buckets set public = false where id = 'slides';

-- Anyone-can-read is exactly what is being removed.
drop policy if exists "slides_select_public" on storage.objects;

-- Signing a URL requires the caller to be able to read the object, so owners
-- still need select. Everyone else now gets nothing.
create policy "slides_select_own" on storage.objects
  for select using (
    bucket_id = 'slides'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
