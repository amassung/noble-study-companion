-- ── Nobi: freeform text boxes ────────────────────────────────────────────────
-- Free-floating, draggable/resizable text boxes placed anywhere on a note's
-- page (GoodNotes-style), coexisting with the normal top-to-bottom editor.
--
-- Coordinates: x and width are fractions (0-1) of the page width so they stay
-- correct at any screen size; y is an absolute pixel offset from the page top.

create table public.note_boxes (
  id          uuid        primary key default gen_random_uuid(),
  note_id     uuid        not null references public.notes(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  x           real        not null default 0.1,
  y           real        not null default 40,
  width       real        not null default 0.4,
  content     text        not null default '',
  font_size   int         not null default 16,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index note_boxes_note_id_idx on public.note_boxes(note_id);

alter table public.note_boxes enable row level security;

create policy "note_boxes_select_own" on public.note_boxes
  for select using (auth.uid() = user_id);

create policy "note_boxes_insert_own" on public.note_boxes
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.notes
      where notes.id = note_id and notes.user_id = auth.uid()
    )
  );

create policy "note_boxes_update_own" on public.note_boxes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "note_boxes_delete_own" on public.note_boxes
  for delete using (auth.uid() = user_id);
