-- ── Nobi: lecture recordings, time-synced to handwriting ────────────────────
--
-- A recording belongs to one note. Each stroke drawn while recording stores
-- the millisecond offset from the start of that recording, so tapping a word
-- can seek the audio to the moment it was written — the thing that makes a
-- recorded lecture searchable by what you wrote rather than by scrubbing.

create table public.note_audio (
  id           uuid        primary key default gen_random_uuid(),
  note_id      uuid        not null references public.notes(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  -- Path within the `recordings` storage bucket.
  path         text        not null,
  duration_ms  integer     not null default 0,
  -- Wall-clock start, so a stroke's offset can be resolved to a real time.
  started_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index note_audio_note_id_idx on public.note_audio(note_id);

alter table public.note_audio enable row level security;

create policy "note_audio_select_own" on public.note_audio
  for select using (auth.uid() = user_id);

create policy "note_audio_insert_own" on public.note_audio
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.notes n
      where n.id = note_id and n.user_id = auth.uid()
    )
  );

create policy "note_audio_update_own" on public.note_audio
  for update using (auth.uid() = user_id);

create policy "note_audio_delete_own" on public.note_audio
  for delete using (auth.uid() = user_id);

-- Which recording a stroke belongs to, and how far into it the stroke was
-- drawn. Nullable: ink written outside a recording has no offset, and every
-- stroke that already exists predates this column.
alter table public.note_ink
  add column if not exists audio_id uuid references public.note_audio(id) on delete set null;

alter table public.note_ink
  add column if not exists t_ms integer;

create index if not exists note_ink_audio_id_idx on public.note_ink(audio_id);

-- ── Storage ─────────────────────────────────────────────────────────────────
-- Private, unlike slides: a lecture recording can carry other people's voices,
-- so it is read back through a signed URL rather than a public one.
insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', false)
on conflict (id) do nothing;

create policy "recordings_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "recordings_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "recordings_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'recordings'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
