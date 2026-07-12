-- ── Nobi: per-note paper override ────────────────────────────────────────────
-- Lets an individual note override its notebook's paper template (e.g. a grid
-- notebook with one plain page). NULL means "inherit the notebook's paper".

alter table public.notes
  add column paper text null
    check (paper is null or paper in ('blank', 'ruled', 'ruled-wide', 'dotted', 'grid'));
