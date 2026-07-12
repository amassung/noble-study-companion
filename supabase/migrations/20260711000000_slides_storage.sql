-- ── Nobi: slide image storage ────────────────────────────────────────────────
-- Slide images used to be stored as base64 data URLs inside notes.body, which
-- made note rows multi-MB and the notes list query unusably heavy. Pages are
-- now uploaded to this bucket and referenced by URL.
--
-- Object paths are `{user_id}/{note_id}/{import_id}-{page}.jpg`; policies key
-- off the first path segment matching auth.uid().

insert into storage.buckets (id, name, public)
values ('slides', 'slides', true)
on conflict (id) do nothing;

create policy "slides_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'slides'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "slides_delete_own" on storage.objects
  for delete using (
    bucket_id = 'slides'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "slides_select_public" on storage.objects
  for select using (bucket_id = 'slides');
