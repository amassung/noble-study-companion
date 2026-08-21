import { useCallback, useEffect, useRef, useState } from "react";
import { getStroke } from "perfect-freehand";
import type { InkStroke, InkTool } from "@/lib/ink/ink-api";

export type InkMode = "off" | "pen" | "highlighter" | "eraser";

type Point = [number, number, number];

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
 * Palm rejection: when a stylus has been seen on this canvas, touch input is
 * ignored, so resting a hand on an iPad doesn't draw. Finger drawing still
 * works on devices with no stylus.
 */
export function InkCanvas({
  noteId,
  mode,
  color,
  size,
  strokes,
  addStroke,
  eraseStrokes,
  onGesture,
}: {
  noteId: string;
  mode: InkMode;
  color: string;
  size: number;
  strokes: InkStroke[];
  addStroke: (stroke: Pick<InkStroke, "points" | "color" | "size" | "tool">) => void;
  eraseStrokes: (ids: string[]) => void;
  onGesture?: (g: { scaleBy: number; dx: number; dy: number }) => void;
}) {
  // Active touch pointers. Two or more means the student is panning/zooming
  // rather than writing, which must keep working mid-session — in GoodNotes
  // two fingers always pan and pinch even with the pen selected.
  const touchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [active, setActive] = useState<Point[]>([]);
  // Mirror of `active` for reads inside event handlers (see finish()).
  const activeRef = useRef<Point[]>([]);
  const pushPoints = (pts: Point[]) => {
    activeRef.current = [...activeRef.current, ...pts];
    setActive(activeRef.current);
  };
  const drawingRef = useRef(false);
  // Set once a stylus is detected; thereafter touch events are ignored.
  const sawStylusRef = useRef(false);
  const erasedRef = useRef<Set<string>>(new Set());

  const isHighlighter = mode === "highlighter";

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const w = host.offsetWidth;
    const h = host.offsetHeight;
    if (!w || !h) return;

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const render = (pts: Point[], strokeColor: string, strokeSize: number, tool: InkTool) => {
      const abs: Point[] = pts.map(([x, y, p]) => [x * w, y, p]);
      const path = strokeToPath(abs, strokeSize, tool === "highlighter" ? 0 : 0.6);
      if (!path) return;
      ctx.save();
      if (tool === "highlighter") {
        ctx.globalAlpha = 0.35;
        ctx.globalCompositeOperation = "multiply";
      }
      ctx.fillStyle = strokeColor;
      ctx.fill(new Path2D(path));
      ctx.restore();
    };

    for (const s of strokes) render(s.points, s.color, s.size, s.tool);
    if (active.length > 1) {
      render(active, color, size, isHighlighter ? "highlighter" : "pen");
    }
  }, [strokes, active, color, size, isHighlighter]);

  useEffect(() => {
    paint();
  }, [paint]);

  // Repaint when the page resizes (rotation, window resize, page growth).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => paint());
    ro.observe(host);
    return () => ro.disconnect();
  }, [paint]);

  const pointFrom = (e: React.PointerEvent): Point => {
    const host = hostRef.current!;
    const rect = host.getBoundingClientRect();
    // When the page is zoomed, rect is the *scaled* box. x is a fraction so it
    // is scale-invariant, but y is stored in unscaled page px and must be
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
  const isPalm = (e: React.PointerEvent) => {
    if (e.pointerType === "pen") {
      sawStylusRef.current = true;
      return false;
    }
    return e.pointerType === "touch" && sawStylusRef.current;
  };

  const eraseAt = (pt: Point) => {
    const w = hostRef.current?.offsetWidth ?? 1;
    const px = pt[0] * w;
    const py = pt[1];
    const hitRadius = Math.max(12, size * 2);
    const hits: string[] = [];
    for (const s of strokes) {
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
    if (hits.length) eraseStrokes(hits);
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

  const onPointerDown = (e: React.PointerEvent) => {
    if (mode === "off") return;

    if (e.pointerType === "touch") {
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchesRef.current.size >= 2) {
        // A second finger landed: this is a gesture, not a stroke. Abandon any
        // stroke in progress so a pinch never leaves a stray mark.
        drawingRef.current = false;
        activeRef.current = [];
        setActive([]);
        syncGesture();
        return;
      }
    }

    if (isPalm(e)) return;
    e.preventDefault();
    // Pointer capture keeps the stroke alive if the pen briefly leaves the
    // canvas, but it can throw (e.g. the pointer is already gone). Never let
    // that abort the stroke — losing handwriting is worse than losing capture.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture unavailable — drawing still works via window-level events */
    }
    drawingRef.current = true;
    const pt = pointFrom(e);
    if (mode === "eraser") {
      erasedRef.current.clear();
      eraseAt(pt);
    } else {
      activeRef.current = [pt];
      setActive(activeRef.current);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (mode === "off") return;

    // Two-finger pan + pinch-zoom, reported to the page so it can transform.
    if (e.pointerType === "touch" && touchesRef.current.has(e.pointerId)) {
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchesRef.current.size >= 2) {
        const prev = gestureRef.current;
        const pts = [...touchesRef.current.values()];
        const [a, b] = pts;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        if (prev && prev.dist > 0) {
          onGesture?.({ scaleBy: dist / prev.dist, dx: cx - prev.cx, dy: cy - prev.cy });
        }
        gestureRef.current = { dist, cx, cy };
        return;
      }
    }

    if (!drawingRef.current || isPalm(e)) return;
    e.preventDefault();
    const pt = pointFrom(e);
    if (mode === "eraser") {
      eraseAt(pt);
      return;
    }
    // Coalesced events give full Pencil sampling rate for smooth strokes.
    const native = e.nativeEvent as PointerEvent & {
      getCoalescedEvents?: () => PointerEvent[];
    };
    const coalesced = native.getCoalescedEvents?.() ?? [];
    if (coalesced.length > 1) {
      const host = hostRef.current!;
      const rect = host.getBoundingClientRect();
      const scale = host.offsetWidth > 0 ? rect.width / host.offsetWidth : 1;
      const pts: Point[] = coalesced.map((c) => [
        (c.clientX - rect.left) / rect.width,
        (c.clientY - rect.top) / scale,
        c.pressure > 0 ? c.pressure : 0.5,
      ]);
      pushPoints(pts);
    } else {
      pushPoints([pt]);
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      touchesRef.current.delete(e.pointerId);
      syncGesture();
    }
    finish();
  };

  const finish = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    erasedRef.current.clear();
    // Read the stroke from a ref, not from inside a setState updater: React
    // may invoke updaters more than once, which fired the save twice and
    // persisted every stroke as two duplicate rows.
    const pts = activeRef.current;
    if (pts.length > 1 && mode !== "eraser" && mode !== "off") {
      addStroke({
        points: pts,
        color,
        size,
        tool: isHighlighter ? "highlighter" : "pen",
      });
    }
    activeRef.current = [];
    setActive([]);
  };

  return (
    <div
      ref={hostRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={endPointer}
      className="absolute inset-0 z-20"
      style={{
        // Off: let clicks reach the text editor underneath.
        pointerEvents: mode === "off" ? "none" : "auto",
        // Prevent scrolling/zooming from stealing the stroke while drawing.
        touchAction: mode === "off" ? "auto" : "none",
        cursor: mode === "off" ? "auto" : "crosshair",
      }}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

export type { InkStroke };
