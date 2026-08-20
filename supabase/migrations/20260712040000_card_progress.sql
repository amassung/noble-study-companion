-- ── Nobi: flashcard review progress (spaced repetition) ─────────────────────
-- Cards are derived from a note's saved study guides rather than stored as
-- rows, so progress is keyed by a stable hash of the card's front text. That
-- way regenerating a guide keeps a student's progress on cards that survive.

create table public.card_progress (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  note_id         uuid        not null references public.notes(id) on delete cascade,
  card_key        text        not null,
  -- SM-2 style scheduling state
  ease            real        not null default 2.5,
  interval_days   real        not null default 0,
  reps            int         not null default 0,
  lapses          int         not null default 0,
  due_at          timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, note_id, card_key)
);

create index card_progress_user_due_idx on public.card_progress(user_id, due_at);
create index card_progress_note_idx on public.card_progress(note_id);

alter table public.card_progress enable row level security;

create policy "card_progress_select_own" on public.card_progress
  for select using (auth.uid() = user_id);

create policy "card_progress_insert_own" on public.card_progress
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.notes
      where notes.id = note_id and notes.user_id = auth.uid()
    )
  );

create policy "card_progress_update_own" on public.card_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "card_progress_delete_own" on public.card_progress
  for delete using (auth.uid() = user_id);
