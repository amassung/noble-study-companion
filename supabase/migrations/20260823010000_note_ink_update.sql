-- Moving and resizing handwriting rewrites a stroke's points and width, which
-- needs an UPDATE policy on note_ink. The table shipped with select/insert/
-- delete only, and under RLS an UPDATE with no matching policy is not an
-- error — it simply matches zero rows. The drag would look right until the
-- page reloaded and every stroke snapped back to where it started.

create policy "note_ink_update_own" on public.note_ink
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
