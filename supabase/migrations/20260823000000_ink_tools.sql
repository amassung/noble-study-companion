-- Pencil and fineliner join pen and highlighter as handwriting tools.
--
-- note_ink.tool carries a CHECK constraint, so the new values have to be
-- admitted here before the client can save a stroke drawn with them —
-- otherwise the insert fails and the student silently loses the stroke.

alter table public.note_ink
  drop constraint if exists note_ink_tool_check;

alter table public.note_ink
  add constraint note_ink_tool_check
  check (tool in ('pen', 'pencil', 'fineliner', 'highlighter'));
