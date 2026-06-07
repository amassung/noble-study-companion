create table public.annotations (
  id          uuid        primary key default gen_random_uuid(),
  note_id     uuid        not null references public.notes(id) on delete cascade,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  slide_key   text        not null,
  type        text        not null check (type in ('text', 'draw', 'highlight')),
  data        jsonb       not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index annotations_note_id_idx on public.annotations(note_id);
create index annotations_user_id_idx on public.annotations(user_id);

alter table public.annotations enable row level security;

create policy "annotations_select_own" on public.annotations
  for select using (auth.uid() = user_id);

create policy "annotations_insert_own" on public.annotations
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.notes
      where notes.id = note_id
      and notes.user_id = auth.uid()
    )
  );

create policy "annotations_update_own" on public.annotations
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "annotations_delete_own" on public.annotations
  for delete using (auth.uid() = user_id);
