-- ── Nobi: page ink (Apple Pencil handwriting on regular note pages) ─────────
-- Freehand strokes drawn directly on a note's page, independent of the PDF
-- slide annotation layer.
--
-- points: JSON array of [x, y, pressure] where x is a 0-1 fraction of page
-- width and y is an absolute pixel offset from the page top (matching the
-- text-box coordinate model, so ink stays aligned as the page grows/reflows).

create table public.note_ink (
  id          uuid        primary key default gen_random_uuid(),
  note_id     uuid        not null references public.notes(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  points      jsonb       not null default '[]',
  color       text        not null default '#000000',
  size        real        not null default 4,
  tool        text        not null default 'pen' check (tool in ('pen', 'highlighter')),
  created_at  timestamptz not null default now()
);

create index note_ink_note_id_idx on public.note_ink(note_id);

alter table public.note_ink enable row level security;

create policy "note_ink_select_own" on public.note_ink
  for select using (auth.uid() = user_id);

create policy "note_ink_insert_own" on public.note_ink
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.notes
      where notes.id = note_id and notes.user_id = auth.uid()
    )
  );

create policy "note_ink_delete_own" on public.note_ink
  for delete using (auth.uid() = user_id);
