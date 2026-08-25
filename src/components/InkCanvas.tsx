import { useEffect, useRef } from "react";
import { getStroke } from "perfect-freehand";
import type { InkStroke, InkTool, StrokeGeometry } from "@/lib/ink/ink-api";
import { inkResolution } from "@/lib/ink/resolution";

export type InkMode = "off" | "select" | "pen" | "pencil" | "fineliner" | "highlighter" | "eraser";

/** A selection rectangle in host pixels (x absolute, y from the page top). */
type Box = { x: number; y: number; w: number; h: number };

// Corner grab size, in px. Generous because a fingertip is not a mouse.
const HANDLE = 11;

type Point = [number, number, number];

const DRAW_TOOLS = ["pen", "pencil", "fineliner", "highlighter"] as const;
const isDrawTool = (m: InkMode): m is InkTool => (DRAW_TOOLS as readonly string[]).includes(m);

/**
 * What separates one nib from another on the page.
 *
 * `thinning` is how much pressure narrows the line: a gel pen responds a lot,
 * a technical pen not at all. `grain` breaks the fill up with paper tooth,
 * which is the difference between "grey pen" and "pencil".
 */
const TOOL_SPEC: Record<
  InkTool,
  { thinning: number; alpha: number; composite: GlobalCompositeOperation; grain: boolean }
> = {
  pen: { thinning: 0.6, alpha: 1, composite: "source-over", grain: false },
  // Pinpoint/technical pen: dead-even width, no pressure response at all.
  fineliner: { thinning: 0, alpha: 1, composite: "source-over", grain: false },
  // Graphite: translucent, strongly pressure-shaded, and speckled.
  pencil: { thinning: 0.8, alpha: 0.8, composite: "source-over", grain: true },
  highlighter: { thinning: 0, alpha: 0.35, composite: "multiply", grain: false },
};

// Graphite sits on the raised tooth of the paper rather than covering it, so a
// pencil stroke needs holes in its fill to read as one. A speckled tile per
// ink colour, built once and repeated across the stroke, does that cheaply.
const grainTiles = new Map<string, HTMLCanvasElement>();
function grainTile(color: string): HTMLCanvasElement | null {
  const cached = grainTiles.get(color);
  if (cached) return cached;
  if (typeof document === "undefined") return null;
  const tile = document.createElement("canvas");
  tile.width = 64;
  tile.height = 64;
  const g = tile.getContext("2d");
  if (!g) return null;
  g.fillStyle = color;
  for (let i = 0; i < 1600; i++) {
    g.globalAlpha = 0.12 + Math.random() * 0.5;
    g.fillRect(Math.random() * 64, Math.random() * 64, 1, 1);
  }
  grainTiles.set(color, tile);
  return tile;
}

// Build an SVG path from a perfect-freehand outline.
function strokeToPath(points: Point[], size: number, thinning: number): string {
  const outline = getStroke(points, {
    size,
    thinning,
    smoothing: 0.55,
    streamline: 0.4,
    simulatePressure: false,
  });
  if (!outline.length) return "";
  const d = [`M ${outline[0][0]} ${outline[0][1]}`];
  for (let i = 1; i < outline.length - 1; i++) {
    const mx = (outline[i][0] + outline[i + 1][0]) / 2;
    const my = (outline[i][1] + outline[i + 1][1]) / 2;
    d.push(`Q ${outline[i][0]} ${outline[i][1]} ${mx} ${my}`);
  }
  d.push("Z");
  return d.join(" ");
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Full-page handwriting canvas (Apple Pencil).
 *
 * Coordinates match the text-box model: x is a 0-1 fraction of page width, y
 * is absolute px from the page top — so ink stays put as the page grows.
 *
 * Two performance/correctness rules govern this component, both learned from
 * Apple Pencil behaving badly on real hardware:
 *
 * 1. The in-progress stroke never touches React state. Putting each sampled
 *    point in state re-rendered the tree and repainted every committed stroke
 *    on the page — at the Pencil's 120Hz that is hundreds of full repaints a
 *    second, and writing lagged badly behind the nib. Committed strokes live
 *    on a base canvas repainted only when they change; the live stroke draws
 *    to its own overlay canvas, once per animation frame.
 *
 * 2. Pointer handlers are attached natively with { passive: false } rather
 *    than through React. React cannot register non-passive listeners, so
 *    preventDefault() on move is unreliable and iOS reclaims the gesture for
 *    scrolling mid-stroke.
 *
 * Palm rejection: when a stylus has been seen on this canvas, touch input is
 * ignored, so resting a hand on an iPad doesn't draw. Finger drawing still
 * works on devices with no stylus.
 */
export function InkCanvas({
  mode,
  color,
  size,
  strokes,
  addStroke,
  eraseStrokes,
  onGesture,
  onGestureEnd,
  moveStrokes,
  onTapEmpty,
  zoom = 1,
}: {
  noteId: string;
  mode: InkMode;
  color: string;
  size: number;
  strokes: InkStroke[];
  addStroke: (stroke: Pick<InkStroke, "points" | "color" | "size" | "tool">) => void;
  eraseStrokes: (ids: string[]) => void;
  // cx/cy are the pinch centre in client coords, so the page can zoom about
  // the point between the fingers instead of a fixed origin.
  onGesture?: (g: { scaleBy: number; dx: number; dy: number; cx: number; cy: number }) => void;
  // Fired when the second finger lifts. The page transforms itself directly
  // while a pinch is in flight; this is when it commits that back to React.
  onGestureEnd?: () => void;
  /** Commit a move/resize of existing strokes. */
  moveStrokes?: (updates: StrokeGeometry[]) => void;
  /** A tap on blank page in select mode — the caller puts the caret there. */
  onTapEmpty?: (clientX: number, clientY: number) => void;
  /**
   * Current page scale. Ink is rasterised, so a CSS transform would stretch
   * the bitmap and the handwriting would go soft exactly the way a zoomed web
   * page does. Feeding the scale in lets the canvas re-render its strokes at
   * the zoomed resolution instead, which is what keeps them looking like ink.
   */
  zoom?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Committed strokes; repainted only when `strokes` changes.
  const baseRef = useRef<HTMLCanvasElement>(null);
  // The stroke currently under the nib; cleared and redrawn each frame.
  const liveRef = useRef<HTMLCanvasElement>(null);

  // Pointer handlers are attached once and must not close over stale props,
  // so the latest values are mirrored here instead of in the dependency list.
  const propsRef = useRef({
    mode,
    color,
    size,
    strokes,
    addStroke,
    eraseStrokes,
    onGesture,
    onGestureEnd,
    moveStrokes,
    onTapEmpty,
    zoom,
  });
  propsRef.current = {
    mode,
    color,
    size,
    strokes,
    addStroke,
    eraseStrokes,
    onGesture,
    onGestureEnd,
    moveStrokes,
    onTapEmpty,
    zoom,
  };

  const activeRef = useRef<Point[]>([]);
  const drawingRef = useRef(false);
  // Set once a stylus is detected; thereafter touch events are ignored.
  const sawStylusRef = useRef(false);
  const erasedRef = useRef<Set<string>>(new Set());
  // Active touch pointers. Two or more means the student is panning/zooming
  // rather than writing, which must keep working mid-session — in GoodNotes
  // two fingers always pan and pinch even with the pen selected.
  const touchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const rafRef = useRef<number | null>(null);
  // Set by the effect below so prop changes can trigger a repaint without
  // tearing down and re-attaching the pointer handlers.
  const repaintRef = useRef<(() => void) | null>(null);

  // ── Selection (arrow tool) ────────────────────────────────────────────────
  // Held in refs, never state: dragging a selection must not re-render this
  // component, for the same reason drawing must not.
  const selectionRef = useRef<{ ids: string[]; box: Box } | null>(null);
  // The freehand lasso being drawn, in host px. GoodNotes lassos by loop, not
  // by rectangle, and a loop is what lets you pick one line out of a page of
  // slanted handwriting without catching its neighbours.
  const lassoRef = useRef<{ x: number; y: number }[] | null>(null);
  // Strokes hidden from the base canvas because they are mid-drag and being
  // drawn, transformed, on the live canvas instead.
  const hiddenRef = useRef<Set<string>>(new Set());
  // Where a marquee began, in both host and client coords — the latter so a
  // tap that turns out not to be a lasso can be forwarded as a caret click.
  const drawStartRef = useRef<{ x: number; y: number; clientX: number; clientY: number } | null>(
    null,
  );
  const dragRef = useRef<{
    kind: "move" | "resize";
    // Fixed point of a resize: the corner opposite the one being dragged.
    ax: number;
    ay: number;
    startX: number;
    startY: number;
    box: Box;
    sx: number;
    sy: number;
    dx: number;
    dy: number;
  } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const base = baseRef.current;
    const live = liveRef.current;
    if (!host || !base || !live) return;

    /** Match both canvases to the host box and device pixel ratio. */
    const measure = () => {
      const w = host.offsetWidth;
      const h = host.offsetHeight;
      if (!w || !h) return null;
      // Backing-store resolution follows the zoom so strokes are re-rendered
      // sharp rather than magnified. See inkResolution for the cap.
      const dpr = inkResolution(window.devicePixelRatio, propsRef.current.zoom ?? 1);
      for (const c of [base, live]) {
        const pw = Math.round(w * dpr);
        const ph = Math.round(h * dpr);
        if (c.width !== pw || c.height !== ph) {
          c.width = pw;
          c.height = ph;
          c.style.width = `${w}px`;
          c.style.height = `${h}px`;
        }
      }
      return { w, h, dpr };
    };

    const renderTo = (
      ctx: CanvasRenderingContext2D,
      w: number,
      pts: Point[],
      strokeColor: string,
      strokeSize: number,
      tool: InkTool,
    ) => {
      const spec = TOOL_SPEC[tool] ?? TOOL_SPEC.pen;
      const abs: Point[] = pts.map(([x, y, p]) => [x * w, y, p]);
      const path = strokeToPath(abs, strokeSize, spec.thinning);
      if (!path) return;
      const p2d = new Path2D(path);
      ctx.save();
      ctx.globalCompositeOperation = spec.composite;
      if (spec.grain) {
        // A soft base coat carries the stroke's shape, then the speckle tile
        // lays the graphite over it. Base alone looks like a faded pen; tile
        // alone is too sparse to read as a line.
        ctx.globalAlpha = spec.alpha * 0.5;
        ctx.fillStyle = strokeColor;
        ctx.fill(p2d);
        const tile = grainTile(strokeColor);
        const pattern = tile ? ctx.createPattern(tile, "repeat") : null;
        if (pattern) {
          ctx.globalAlpha = spec.alpha;
          ctx.fillStyle = pattern;
          ctx.fill(p2d);
        }
      } else {
        ctx.globalAlpha = spec.alpha;
        ctx.fillStyle = strokeColor;
        ctx.fill(p2d);
      }
      ctx.restore();
    };

    const paintBase = () => {
      const dims = measure();
      if (!dims) return;
      const ctx = base.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
      ctx.clearRect(0, 0, dims.w, dims.h);
      for (const s of propsRef.current.strokes) {
        // Mid-drag the selection is drawn transformed on the live canvas; if
        // it also stayed here the original would sit underneath as a ghost.
        if (hiddenRef.current.has(s.id)) continue;
        renderTo(ctx, dims.w, s.points, s.color, s.size, s.tool);
      }
    };

    /** Bounding box of the given strokes, in host px. */
    const boundsOf = (ids: string[], w: number): Box | null => {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const st of propsRef.current.strokes) {
        if (!ids.includes(st.id)) continue;
        // Half the nib width spills past the centre line on each side.
        const pad = st.size / 2;
        for (const [x, y] of st.points) {
          minX = Math.min(minX, x * w - pad);
          maxX = Math.max(maxX, x * w + pad);
          minY = Math.min(minY, y - pad);
          maxY = Math.max(maxY, y + pad);
        }
      }
      if (minX === Infinity) return null;
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    };

    /** Move/scale one point under the drag in flight. */
    const transformPoint = (pt: Point, w: number): Point => {
      const d = dragRef.current;
      if (!d) return pt;
      const x = pt[0] * w;
      const y = pt[1];
      return [(d.ax + (x - d.ax) * d.sx + d.dx) / w, d.ay + (y - d.ay) * d.sy + d.dy, pt[2]];
    };

    const drawSelectionChrome = (ctx: CanvasRenderingContext2D, box: Box) => {
      // A little breathing room so the outline never clips the ink it holds.
      const b = { x: box.x - 6, y: box.y - 6, w: box.w + 12, h: box.h + 12 };
      ctx.save();
      ctx.beginPath();
      const rr = 8;
      ctx.roundRect(b.x, b.y, b.w, b.h, rr);
      ctx.fillStyle = "rgba(124,58,237,0.06)";
      ctx.fill();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(124,58,237,0.9)";
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.lineWidth = 1.5;
      for (const [hx, hy] of [
        [b.x, b.y],
        [b.x + b.w, b.y],
        [b.x, b.y + b.h],
        [b.x + b.w, b.y + b.h],
      ]) {
        ctx.beginPath();
        ctx.arc(hx, hy, HANDLE / 2, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#7c3aed";
        ctx.stroke();
      }
      ctx.restore();
    };

    /** Ray-cast point-in-polygon, for testing strokes against the lasso. */
    const inPolygon = (px: number, py: number, poly: { x: number; y: number }[]) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x;
        const yi = poly[i].y;
        const xj = poly[j].x;
        const yj = poly[j].y;
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };

    const paintLive = () => {
      const dims = measure();
      if (!dims) return;
      const ctx = live.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dims.dpr, 0, 0, dims.dpr, 0, 0);
      ctx.clearRect(0, 0, dims.w, dims.h);
      const { color: c, size: s, mode: m } = propsRef.current;

      // The stroke under the nib.
      const pts = activeRef.current;
      if (pts.length) renderTo(ctx, dims.w, pts, c, s, isDrawTool(m) ? m : "pen");

      // A selection being dragged, drawn at its new position.
      const drag = dragRef.current;
      const sel = selectionRef.current;
      if (drag && sel) {
        const scale = (drag.sx + drag.sy) / 2;
        for (const st of propsRef.current.strokes) {
          if (!sel.ids.includes(st.id)) continue;
          renderTo(
            ctx,
            dims.w,
            st.points.map((pt) => transformPoint(pt, dims.w)),
            st.color,
            st.size * scale,
            st.tool,
          );
        }
      }

      // Chrome last, so it sits above the ink.
      if (sel) {
        const box = drag
          ? {
              x: drag.ax + (sel.box.x - drag.ax) * drag.sx + drag.dx,
              y: drag.ay + (sel.box.y - drag.ay) * drag.sy + drag.dy,
              w: sel.box.w * drag.sx,
              h: sel.box.h * drag.sy,
            }
          : sel.box;
        drawSelectionChrome(ctx, box);
      }
      const lasso = lassoRef.current;
      if (lasso && lasso.length > 1) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(lasso[0].x, lasso[0].y);
        for (let i = 1; i < lasso.length; i++) ctx.lineTo(lasso[i].x, lasso[i].y);
        ctx.closePath();
        ctx.fillStyle = "rgba(124,58,237,0.07)";
        ctx.fill();
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#7c3aed";
        ctx.stroke();
        ctx.restore();
      }
    };

    // Coalesce every sample that arrives within one frame into a single paint.
    // The pending flag is tracked separately from the frame handle: clearing
    // the handle inside the callback would be undone by the assignment that
    // follows it, wedging the scheduler permanently.
    let livePending = false;
    const scheduleLive = () => {
      if (livePending) return;
      livePending = true;
      rafRef.current = requestAnimationFrame(() => {
        livePending = false;
        rafRef.current = null;
        paintLive();
      });
    };

    // Expose repaint to the effects below without re-creating the handlers.
    repaintRef.current = () => {
      // A selection holds stroke ids, and ids are not stable: a freshly drawn
      // stroke carries a temporary one until its insert returns, then swaps to
      // the server id. Left alone, the selection would keep pointing at ids
      // that no longer exist — the box still drew, but every move and resize
      // matched zero strokes and silently did nothing. Re-anchor it here, and
      // drop it entirely if nothing it referred to survived.
      const sel = selectionRef.current;
      if (sel && !dragRef.current) {
        const present = new Set(propsRef.current.strokes.map((s) => s.id));
        const ids = sel.ids.filter((id) => present.has(id));
        const box = ids.length ? boundsOf(ids, host.offsetWidth || 1) : null;
        selectionRef.current = box ? { ids, box } : null;
      }
      paintBase();
      paintLive();
    };
    paintBase();

    const pointFrom = (e: { clientX: number; clientY: number; pressure: number }): Point => {
      const rect = host.getBoundingClientRect();
      // When the page is zoomed, rect is the *scaled* box. x is a fraction so
      // it is scale-invariant, but y is stored in unscaled page px and must be
      // divided by the scale or ink would land lower and lower as you zoom in.
      const scale = host.offsetWidth > 0 ? rect.width / host.offsetWidth : 1;
      return [
        (e.clientX - rect.left) / rect.width,
        (e.clientY - rect.top) / scale,
        // Pencil reports real pressure; mouse/touch report 0 or 0.5.
        e.pressure > 0 ? e.pressure : 0.5,
      ];
    };

    // True when this event should be ignored as a resting palm.
    const isPalm = (e: PointerEvent) => {
      if (e.pointerType === "pen") {
        sawStylusRef.current = true;
        return false;
      }
      return e.pointerType === "touch" && sawStylusRef.current;
    };

    const eraseAt = (pt: Point) => {
      const w = host.offsetWidth || 1;
      const px = pt[0] * w;
      const py = pt[1];
      const hitRadius = Math.max(12, propsRef.current.size * 2);
      const hits: string[] = [];
      for (const s of propsRef.current.strokes) {
        if (erasedRef.current.has(s.id)) continue;
        for (let i = 1; i < s.points.length; i++) {
          const [ax, ay] = [s.points[i - 1][0] * w, s.points[i - 1][1]];
          const [bx, by] = [s.points[i][0] * w, s.points[i][1]];
          if (distToSegment(px, py, ax, ay, bx, by) <= hitRadius) {
            hits.push(s.id);
            erasedRef.current.add(s.id);
            break;
          }
        }
      }
      if (hits.length) propsRef.current.eraseStrokes(hits);
    };

    /** Recompute the pinch baseline from the currently-down touches. */
    const syncGesture = () => {
      const pts = [...touchesRef.current.values()];
      if (pts.length < 2) {
        gestureRef.current = null;
        return;
      }
      const [a, b] = pts;
      gestureRef.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
    };

    const finish = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      erasedRef.current.clear();
      const pts = activeRef.current;
      const { mode: m, color: c, size: s, addStroke: add } = propsRef.current;
      if (pts.length > 1 && isDrawTool(m)) {
        add({ points: pts, color: c, size: s, tool: m });
      }
      activeRef.current = [];
      scheduleLive();
    };

    /** Which corner handle, if any, is under this point. */
    const handleAt = (px: number, py: number, box: Box): string | null => {
      const near = (a: number, b: number) => Math.abs(a - b) <= HANDLE;
      const l = near(px, box.x);
      const r = near(px, box.x + box.w);
      const t = near(py, box.y);
      const b = near(py, box.y + box.h);
      if (l && t) return "nw";
      if (r && t) return "ne";
      if (l && b) return "sw";
      if (r && b) return "se";
      return null;
    };

    /** The topmost stroke under this point, if any. */
    const strokeAt = (px: number, py: number, w: number): string | null => {
      const list = propsRef.current.strokes;
      for (let i = list.length - 1; i >= 0; i--) {
        const st = list[i];
        const hit = Math.max(10, st.size);
        for (let j = 1; j < st.points.length; j++) {
          const ax = st.points[j - 1][0] * w;
          const ay = st.points[j - 1][1];
          const bx = st.points[j][0] * w;
          const by = st.points[j][1];
          if (distToSegment(px, py, ax, ay, bx, by) <= hit) return st.id;
        }
      }
      return null;
    };

    /** Write the finished drag back through the caller. */
    const commitDrag = (w: number) => {
      const drag = dragRef.current;
      const sel = selectionRef.current;
      if (!drag || !sel) {
        dragRef.current = null;
        return;
      }
      const moved = drag.dx !== 0 || drag.dy !== 0 || drag.sx !== 1 || drag.sy !== 1;
      if (moved) {
        const scale = (drag.sx + drag.sy) / 2;
        const updates: StrokeGeometry[] = [];
        for (const st of propsRef.current.strokes) {
          if (!sel.ids.includes(st.id)) continue;
          updates.push({
            id: st.id,
            // transformPoint reads dragRef, so the drag has to still be in
            // place here — clearing it first silently returns the points
            // unchanged and the move never happens.
            points: st.points.map((pt) => transformPoint(pt, w)),
            size: st.size * scale,
          });
        }
        propsRef.current.moveStrokes?.(updates);
      }
      // Carry the box through the same transform. Re-deriving it from the
      // strokes would read the pre-move geometry: the optimistic cache write
      // above has not re-rendered this component yet.
      selectionRef.current = {
        ids: sel.ids,
        box: {
          x: drag.ax + (sel.box.x - drag.ax) * drag.sx + drag.dx,
          y: drag.ay + (sel.box.y - drag.ay) * drag.sy + drag.dy,
          w: sel.box.w * drag.sx,
          h: sel.box.h * drag.sy,
        },
      };
      dragRef.current = null;
      hiddenRef.current = new Set();
      paintBase();
      scheduleLive();
    };

    const onDown = (e: PointerEvent) => {
      if (propsRef.current.mode === "off") return;

      if (e.pointerType === "touch") {
        touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touchesRef.current.size >= 2) {
          // A second finger landed: this is a gesture, not a stroke. Abandon
          // any stroke in progress so a pinch never leaves a stray mark.
          drawingRef.current = false;
          activeRef.current = [];
          scheduleLive();
          syncGesture();
          return;
        }
      }

      if (isPalm(e)) return;
      e.preventDefault();

      if (propsRef.current.mode === "select") {
        const host_w = host.offsetWidth || 1;
        const pt = pointFrom(e);
        const px = pt[0] * host_w;
        const py = pt[1];
        const sel = selectionRef.current;
        try {
          host.setPointerCapture(e.pointerId);
        } catch {
          /* capture unavailable */
        }

        // A corner of the current selection: resize about the far corner.
        const handle = sel ? handleAt(px, py, sel.box) : null;
        if (sel && handle) {
          const ax = handle === "ne" || handle === "se" ? sel.box.x : sel.box.x + sel.box.w;
          const ay = handle === "sw" || handle === "se" ? sel.box.y : sel.box.y + sel.box.h;
          dragRef.current = {
            kind: "resize",
            ax,
            ay,
            startX: px,
            startY: py,
            box: sel.box,
            sx: 1,
            sy: 1,
            dx: 0,
            dy: 0,
          };
          hiddenRef.current = new Set(sel.ids);
          paintBase();
          scheduleLive();
          return;
        }

        // Inside the current selection, or on one of its strokes: move it.
        const inside =
          sel &&
          px >= sel.box.x &&
          px <= sel.box.x + sel.box.w &&
          py >= sel.box.y &&
          py <= sel.box.y + sel.box.h;
        if (sel && inside) {
          dragRef.current = {
            kind: "move",
            ax: 0,
            ay: 0,
            startX: px,
            startY: py,
            box: sel.box,
            sx: 1,
            sy: 1,
            dx: 0,
            dy: 0,
          };
          hiddenRef.current = new Set(sel.ids);
          paintBase();
          scheduleLive();
          return;
        }

        // A stroke elsewhere: select just that one and start moving it.
        const hitId = strokeAt(px, py, host_w);
        if (hitId) {
          const box = boundsOf([hitId], host_w);
          if (box) {
            selectionRef.current = { ids: [hitId], box };
            dragRef.current = {
              kind: "move",
              ax: 0,
              ay: 0,
              startX: px,
              startY: py,
              box,
              sx: 1,
              sy: 1,
              dx: 0,
              dy: 0,
            };
            hiddenRef.current = new Set([hitId]);
            paintBase();
            scheduleLive();
          }
          return;
        }

        // Blank page: begin a lasso. Whether this turns out to be a loop or
        // a plain tap is decided on release.
        selectionRef.current = null;
        lassoRef.current = [{ x: px, y: py }];
        drawStartRef.current = { x: px, y: py, clientX: e.clientX, clientY: e.clientY };
        scheduleLive();
        return;
      }

      // Pointer capture keeps the stroke alive if the pen briefly leaves the
      // canvas, but it can throw (e.g. the pointer is already gone). Never let
      // that abort the stroke — losing handwriting is worse than losing capture.
      try {
        host.setPointerCapture(e.pointerId);
      } catch {
        /* capture unavailable — the stroke still tracks via move events */
      }
      drawingRef.current = true;
      const pt = pointFrom(e);
      if (propsRef.current.mode === "eraser") {
        erasedRef.current.clear();
        eraseAt(pt);
      } else {
        activeRef.current = [pt];
        scheduleLive();
      }
    };

    const onMove = (e: PointerEvent) => {
      if (propsRef.current.mode === "off") return;

      // Two-finger pan + pinch-zoom, reported to the page so it can transform.
      if (e.pointerType === "touch" && touchesRef.current.has(e.pointerId)) {
        touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touchesRef.current.size >= 2) {
          const prev = gestureRef.current;
          const [a, b] = [...touchesRef.current.values()];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          const cx = (a.x + b.x) / 2;
          const cy = (a.y + b.y) / 2;
          if (prev && prev.dist > 0) {
            propsRef.current.onGesture?.({
              scaleBy: dist / prev.dist,
              dx: cx - prev.cx,
              dy: cy - prev.cy,
              cx,
              cy,
            });
          }
          gestureRef.current = { dist, cx, cy };
          return;
        }
      }

      if (propsRef.current.mode === "select") {
        const host_w = host.offsetWidth || 1;
        const pt = pointFrom(e);
        const px = pt[0] * host_w;
        const py = pt[1];
        const drag = dragRef.current;
        if (drag) {
          e.preventDefault();
          if (drag.kind === "move") {
            drag.dx = px - drag.startX;
            drag.dy = py - drag.startY;
          } else {
            // Guard against a zero-width denominator when a corner is grabbed
            // exactly on the anchor axis, and against flipping through zero.
            const spanX = drag.startX - drag.ax;
            const spanY = drag.startY - drag.ay;
            drag.sx = Math.abs(spanX) < 1 ? 1 : Math.max(0.1, (px - drag.ax) / spanX);
            drag.sy = Math.abs(spanY) < 1 ? 1 : Math.max(0.1, (py - drag.ay) / spanY);
          }
          scheduleLive();
          return;
        }
        if (lassoRef.current) {
          e.preventDefault();
          const last = lassoRef.current[lassoRef.current.length - 1];
          // Thin the path: every sample would bloat the polygon test without
          // making the loop any more accurate.
          if (!last || Math.hypot(px - last.x, py - last.y) > 2) {
            lassoRef.current.push({ x: px, y: py });
            scheduleLive();
          }
        }
        return;
      }

      if (!drawingRef.current || isPalm(e)) return;
      e.preventDefault();

      if (propsRef.current.mode === "eraser") {
        eraseAt(pointFrom(e));
        return;
      }

      // Coalesced events carry every sample the Pencil took since the last
      // frame, so the stroke keeps full 120Hz detail even though we paint at
      // display rate. Safari returns an empty list rather than omitting the
      // method, so fall back to the event itself.
      const coalesced = e.getCoalescedEvents?.() ?? [];
      const samples = coalesced.length ? coalesced : [e];
      const rect = host.getBoundingClientRect();
      const scale = host.offsetWidth > 0 ? rect.width / host.offsetWidth : 1;
      for (const c of samples) {
        activeRef.current.push([
          (c.clientX - rect.left) / rect.width,
          (c.clientY - rect.top) / scale,
          c.pressure > 0 ? c.pressure : 0.5,
        ]);
      }
      scheduleLive();
    };

    const onUp = (e: PointerEvent) => {
      if (propsRef.current.mode === "select") {
        const host_w = host.offsetWidth || 1;
        try {
          host.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
        if (dragRef.current) {
          commitDrag(host_w);
          return;
        }
        const lasso = lassoRef.current;
        lassoRef.current = null;
        const st = drawStartRef.current;
        drawStartRef.current = null;
        const xs = lasso ? lasso.map((q) => q.x) : [];
        const ys = lasso ? lasso.map((q) => q.y) : [];
        const looped =
          lasso &&
          lasso.length > 4 &&
          (Math.max(...xs) - Math.min(...xs) > 8 || Math.max(...ys) - Math.min(...ys) > 8);
        if (looped && lasso) {
          // Majority rule rather than every-point-inside: a loop drawn at
          // speed always clips a tail or an ascender, and demanding perfect
          // enclosure made the tool feel broken.
          const ids = propsRef.current.strokes
            .filter((s2) => {
              let inside = 0;
              for (const [x, y] of s2.points) if (inPolygon(x * host_w, y, lasso)) inside++;
              return inside / s2.points.length >= 0.6;
            })
            .map((s2) => s2.id);
          const box = ids.length ? boundsOf(ids, host_w) : null;
          selectionRef.current = box ? { ids, box } : null;
        } else if (st) {
          // A tap on blank page: let the caller put the text caret there.
          propsRef.current.onTapEmpty?.(st.clientX, st.clientY);
        }
        scheduleLive();
        return;
      }
      if (e.pointerType === "touch") {
        const wasGesture = touchesRef.current.size >= 2;
        touchesRef.current.delete(e.pointerId);
        syncGesture();
        if (wasGesture && touchesRef.current.size < 2) propsRef.current.onGestureEnd?.();
      }
      try {
        host.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      finish();
    };

    // pointercancel commits rather than discards: iOS raises it for reasons
    // that have nothing to do with intent (a system gesture, a notification),
    // and throwing away what was already written loses the student's work.
    //
    // Deliberately NOT bound: pointerleave. It fires as soon as the nib
    // crosses a hit-test boundary, which ended each stroke a sample or two in
    // and left a trail of dots instead of handwriting.
    const opts: AddEventListenerOptions = { passive: false };
    host.addEventListener("pointerdown", onDown, opts);
    host.addEventListener("pointermove", onMove, opts);
    host.addEventListener("pointerup", onUp, opts);
    host.addEventListener("pointercancel", onUp, opts);

    // touch-action alone does not stop iOS from claiming a one-finger drag as
    // a scroll once the stroke is underway. Swallowing single-touch defaults
    // does; two or more touches pass through to the pan/zoom path above.
    const swallowTouch = (e: TouchEvent) => {
      if (propsRef.current.mode === "off") return;
      if (e.touches.length >= 2) return;
      e.preventDefault();
    };
    host.addEventListener("touchstart", swallowTouch, opts);
    host.addEventListener("touchmove", swallowTouch, opts);

    const ro = new ResizeObserver(() => {
      paintBase();
      paintLive();
    });
    ro.observe(host);

    return () => {
      host.removeEventListener("pointerdown", onDown, opts);
      host.removeEventListener("pointermove", onMove, opts);
      host.removeEventListener("pointerup", onUp, opts);
      host.removeEventListener("pointercancel", onUp, opts);
      host.removeEventListener("touchstart", swallowTouch, opts);
      host.removeEventListener("touchmove", swallowTouch, opts);
      ro.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      repaintRef.current = null;
    };
  }, []);

  useEffect(() => {
    // Leaving the arrow tool drops the selection: a dashed box left floating
    // over the page while the pen is active is just confusing.
    if (mode !== "select" && selectionRef.current) {
      selectionRef.current = null;
      lassoRef.current = null;
      dragRef.current = null;
      hiddenRef.current = new Set();
    }
    repaintRef.current?.();
  }, [strokes, color, size, mode, zoom]);

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 z-20"
      style={{
        // Off: let clicks reach the text editor underneath.
        pointerEvents: mode === "off" ? "none" : "auto",
        // Prevent scrolling/zooming from stealing the stroke while drawing.
        touchAction: mode === "off" ? "auto" : "none",
        // A long press with the Pencil must not raise the text-selection
        // loupe or the share callout over the page being written on.
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <canvas ref={baseRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={liveRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

export type { InkStroke };
