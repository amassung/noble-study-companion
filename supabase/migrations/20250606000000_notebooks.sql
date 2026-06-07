-- ── Nobi: notebooks ──────────────────────────────────────────────────────────

create table public.notebooks (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null default '',
  emoji       text        not null default '📓',
  color       text        not null default 'violet'
                check (color in ('violet','sky','emerald','amber','rose','indigo')),
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index notebooks_user_id_idx on public.notebooks(user_id);

alter table public.notebooks enable row level security;

create policy "notebooks_select_own" on public.notebooks
  for select using (auth.uid() = user_id);

create policy "notebooks_insert_own" on public.notebooks
  for insert with check (auth.uid() = user_id);

create policy "notebooks_update_own" on public.notebooks
  for update using  (auth.uid() = user_id)
  with check       (auth.uid() = user_id);

create policy "notebooks_delete_own" on public.notebooks
  for delete using  (auth.uid() = user_id);

-- ── Add notebook_id FK to notes ───────────────────────────────────────────────

alter table public.notes
  add column notebook_id uuid null
    references public.notebooks(id) on delete set null;

create index notes_notebook_id_idx on public.notes(notebook_id);

-- ── Tighten notes insert / update policies to verify notebook ownership ───────
-- (Must drop and recreate — ALTER POLICY does not support WITH CHECK changes.)

drop policy "notes_insert_own" on public.notes;
drop policy "notes_update_own" on public.notes;

create policy "notes_insert_own" on public.notes
  for insert with check (
    auth.uid() = user_id
    and (
      notebook_id is null
      or exists (
        select 1 from public.notebooks
        where id = notebook_id and user_id = auth.uid()
      )
    )
  );

create policy "notes_update_own" on public.notes
  for update
  using  (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      notebook_id is null
      or exists (
        select 1 from public.notebooks
        where id = notebook_id and user_id = auth.uid()
      )
    )
  );
