export type Point = [number, number, number];

/**
 * Snap a drawn stroke to the shape it was meant to be.
 *
 * Diagrams are most of what a nursing student draws that is not words — a
 * circle round a lab value, a box round a drug class, an arrow from cause to
 * effect — and freehand versions of those look careless next to the
 * handwriting around them.
 *
 * Everything here works on points in page space: x already multiplied out to
 * pixels, so distances mean the same in both axes. Pressure is replaced with a
 * constant, because a snapped shape should have an even stroke rather than
 * inherit the wobble of the hand that drew it.
 */

/** How close to a perfect form a stroke must be, as a fraction of its size. */
const TOLERANCE = 0.22;

/** Shapes smaller than this are more likely a letter or a tick than a shape. */
const MIN_SIZE = 24;

export type ShapeKind = "line" | "circle" | "rectangle" | "triangle";

export interface Recognized {
  kind: ShapeKind;
  points: Point[];
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);

function bounds(pts: Point[]) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

/** Total length walked along the stroke. */
function pathLength(pts: Point[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  }
  return total;
}

/** Mean distance from each point to the straight line between the ends. */
function straightness(pts: Point[]): number {
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const len = dist(ax, ay, bx, by);
  if (len < 1) return Infinity;
  let sum = 0;
  for (const [x, y] of pts) {
    // Perpendicular distance from the point to the line through the ends.
    sum += Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / len;
  }
  return sum / pts.length;
}

const P = (x: number, y: number): Point => [x, y, 0.6];

/** Points along a straight segment, enough for a smooth outline. */
function line(ax: number, ay: number, bx: number, by: number, steps = 12): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    out.push(P(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps));
  }
  return out;
}

function polygon(corners: [number, number][]): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    // Drop each segment's last point: the next segment starts there.
    out.push(...line(a[0], a[1], b[0], b[1]).slice(0, -1));
  }
  out.push(P(corners[0][0], corners[0][1]));
  return out;
}

function ellipse(cx: number, cy: number, rx: number, ry: number, steps = 48): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    out.push(P(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry));
  }
  return out;
}

/**
 * Recognise a stroke, or return null to leave it exactly as drawn.
 *
 * Null is the safe answer and the common one. Turning handwriting into a
 * rectangle because it happened to be boxy would be far worse than never
 * snapping at all, so every test here is deliberately strict and anything
 * ambiguous is left alone.
 */
export function recognizeShape(pts: Point[]): Recognized | null {
  if (pts.length < 8) return null;

  const b = bounds(pts);
  const size = Math.max(b.w, b.h);
  if (size < MIN_SIZE) return null;

  const start = pts[0];
  const end = pts[pts.length - 1];
  const gap = dist(start[0], start[1], end[0], end[1]);
  const perimeter = pathLength(pts);
  if (perimeter < MIN_SIZE) return null;

  // ── Open: a line, if it is straight enough ───────────────────────────────
  const closed = gap < size * 0.3;
  if (!closed) {
    // Flatness alone is not enough: a word written in cursive is flat on
    // average — its ups and downs cancel — and straightening someone's
    // handwriting into a rule is the worst thing this function could do. A
    // genuinely straight stroke also travels no further than the distance
    // between its ends, which a wavy one always does.
    const wander = perimeter / Math.max(1, gap);
    if (straightness(pts) <= size * 0.04 && wander < 1.06) {
      return { kind: "line", points: line(start[0], start[1], end[0], end[1]) };
    }
    return null;
  }

  // ── Closed: circle, rectangle, or triangle ───────────────────────────────
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const rx = b.w / 2;
  const ry = b.h / 2;

  // A rectangle's path is close to twice its width plus twice its height, and
  // its points hug the edges of the bounding box.
  const boxPerimeter = 2 * (b.w + b.h);
  if (b.w > MIN_SIZE / 2 && b.h > MIN_SIZE / 2) {
    const ratio = perimeter / boxPerimeter;
    if (ratio > 0.82 && ratio < 1.2) {
      let onEdge = 0;
      const slack = size * TOLERANCE * 0.6;
      for (const [x, y] of pts) {
        const near = Math.min(x - b.x0, b.x1 - x) <= slack || Math.min(y - b.y0, b.y1 - y) <= slack;
        if (near) onEdge++;
      }
      if (onEdge / pts.length > 0.9) {
        return {
          kind: "rectangle",
          points: polygon([
            [b.x0, b.y0],
            [b.x1, b.y0],
            [b.x1, b.y1],
            [b.x0, b.y1],
          ]),
        };
      }
    }
  }

  // A circle keeps a near-constant radius, measured against the ellipse that
  // fits the bounding box so ovals count too.
  if (rx > 4 && ry > 4) {
    let err = 0;
    for (const [x, y] of pts) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      err += Math.abs(Math.hypot(nx, ny) - 1);
    }
    if (err / pts.length <= TOLERANCE) {
      return { kind: "circle", points: ellipse(cx, cy, rx, ry) };
    }
  }

  // A triangle: three corners, found as the points furthest from each other.
  const tri = triangleCorners(pts);
  if (tri) {
    const triPerimeter =
      dist(tri[0][0], tri[0][1], tri[1][0], tri[1][1]) +
      dist(tri[1][0], tri[1][1], tri[2][0], tri[2][1]) +
      dist(tri[2][0], tri[2][1], tri[0][0], tri[0][1]);
    const ratio = perimeter / triPerimeter;
    if (ratio > 0.85 && ratio < 1.18) return { kind: "triangle", points: polygon(tri) };
  }

  return null;
}

/** The three points of a closed stroke that are furthest apart. */
function triangleCorners(pts: Point[]): [number, number][] | null {
  let a = 0;
  let b = 0;
  let best = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = dist(pts[i][0], pts[i][1], pts[j][0], pts[j][1]);
      if (d > best) {
        best = d;
        a = i;
        b = j;
      }
    }
  }
  if (best < MIN_SIZE) return null;

  let c = -1;
  let far = 0;
  for (let i = 0; i < pts.length; i++) {
    const d =
      dist(pts[i][0], pts[i][1], pts[a][0], pts[a][1]) +
      dist(pts[i][0], pts[i][1], pts[b][0], pts[b][1]);
    if (d > far) {
      far = d;
      c = i;
    }
  }
  if (c < 0) return null;
  // A third corner that sits on the line between the other two is not a
  // triangle, it is a line drawn back on itself.
  const height = straightness([pts[a], pts[c], pts[b]]);
  if (height < best * 0.12) return null;

  return [
    [pts[a][0], pts[a][1]],
    [pts[c][0], pts[c][1]],
    [pts[b][0], pts[b][1]],
  ];
}
