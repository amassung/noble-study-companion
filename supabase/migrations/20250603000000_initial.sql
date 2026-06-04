-- Nobi: notes + study guides with row-level security

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  body text not null default '',
  subject text not null check (subject in ('violet', 'blue', 'green', 'amber')),
  subject_label text,
  test_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_guides (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  guide jsonb not null,
  created_at timestamptz not null default now()
);

create index notes_user_id_idx on public.notes (user_id);
create index notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index study_guides_note_id_idx on public.study_guides (note_id);

alter table public.notes enable row level security;
alter table public.study_guides enable row level security;

create policy "notes_select_own"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "notes_insert_own"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "notes_update_own"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notes_delete_own"
  on public.notes for delete
  using (auth.uid() = user_id);

create policy "study_guides_select_own"
  on public.study_guides for select
  using (auth.uid() = user_id);

create policy "study_guides_insert_own"
  on public.study_guides for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.notes
      where notes.id = note_id and notes.user_id = auth.uid()
    )
  );

create policy "study_guides_delete_own"
  on public.study_guides for delete
  using (auth.uid() = user_id);
