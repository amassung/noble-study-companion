/**
 * Group remembered stroke colours for write-back.
 *
 * Undoing a recolour has to give every stroke its own colour back: a
 * selection can span black and red, and restoring the lot to whichever colour
 * happened to come first would quietly destroy the other. Grouping by colour
 * turns that into one write per distinct colour rather than one per stroke.
 *
 * Pure and separate from the history hook so it can be tested without a
 * database behind it.
 */
export function groupByColor(entries: { id: string; color: string }[]): [string, string[]][] {
  const byColor = new Map<string, string[]>();
  for (const e of entries) {
    const list = byColor.get(e.color);
    if (list) list.push(e.id);
    else byColor.set(e.color, [e.id]);
  }
  return [...byColor];
}
