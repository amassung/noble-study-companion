export type DockEdge = "top" | "bottom" | "left" | "right";

export interface DockState {
  edge: DockEdge;
  collapsed: boolean;
}

export const DEFAULT_DOCK: DockState = { edge: "top", collapsed: false };

/** Vertical edges stand the palette on its side, the way GoodNotes does. */
export function isVertical(edge: DockEdge): boolean {
  return edge === "left" || edge === "right";
}

/**
 * Which edge a dragged palette belongs to.
 *
 * Free positioning sounds more flexible and is worse: a palette left mid-page
 * covers the writing, and one nudged half off-screen is hard to grab back.
 * Snapping to an edge means it is always out of the way and always findable,
 * and it is what every drawing app on the iPad does.
 *
 * The nearest edge wins, measured as a fraction of each axis so the choice
 * does not change with window shape — on a wide screen a point can be far
 * nearer the top in pixels while plainly belonging to the left.
 */
export function nearestEdge(x: number, y: number, width: number, height: number): DockEdge {
  if (width <= 0 || height <= 0) return "top";
  const fx = Math.min(Math.max(x / width, 0), 1);
  const fy = Math.min(Math.max(y / height, 0), 1);

  // Order matters only for ties, and the horizontal edges come first on
  // purpose: a palette laid out as a row is easier to read than one on its
  // side, so it is the better answer when a drag is genuinely ambiguous.
  const distances: [DockEdge, number][] = [
    ["top", fy],
    ["bottom", 1 - fy],
    ["left", fx],
    ["right", 1 - fx],
  ];
  let best: DockEdge = "top";
  let bestD = Infinity;
  for (const [edge, d] of distances) {
    if (d < bestD - 1e-9) {
      bestD = d;
      best = edge;
    }
  }
  return best;
}

const STORAGE_KEY = "nobi:toolbarDock";

export function readDock(): DockState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DOCK;
    const v = JSON.parse(raw) as Partial<DockState>;
    const edge: DockEdge =
      v?.edge === "top" || v?.edge === "bottom" || v?.edge === "left" || v?.edge === "right"
        ? v.edge
        : DEFAULT_DOCK.edge;
    return { edge, collapsed: v?.collapsed === true };
  } catch {
    // Private browsing, cleared storage, or a value from an older shape.
    return DEFAULT_DOCK;
  }
}

export function writeDock(state: DockState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Not remembering where it was put is no reason to refuse to move it now.
  }
}
