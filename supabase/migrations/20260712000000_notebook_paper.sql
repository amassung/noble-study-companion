-- ── Nobi: notebook paper templates ──────────────────────────────────────────
-- Adds a per-notebook paper template (GoodNotes-style): the background ruling
-- rendered behind note content. Notes inherit their notebook's paper.

alter table public.notebooks
  add column paper text not null default 'blank'
    check (paper in ('blank', 'ruled', 'ruled-wide', 'dotted', 'grid'));
