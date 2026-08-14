/**
 * AnnotatedSlide — custom Tiptap node view for slide images (those with data-slide-key).
 *
 * Layers (bottom to top):
 *  1. <img>                 — the rendered PDF page
 *  2. highlight divs        — semi-transparent rectangles
 *  3. <canvas>              — freehand draw strokes (via perfect-freehand)
 *  4. text box <div>s       — draggable text annotations
 *
 * All x/y/width/height values stored in Supabase are 0-1 ratios of the slide's
 * rendered pixel dimensions so they stay correct at any screen width.
 */
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { X as XIcon } from "lucide-react";
import { getStroke } from "perfect-freehand";
import { useAnnotationContext } from "./AnnotationContext";
import {
  useAnnotations,
  useUpsertAnnotationMutation,
  useDeleteAnnotationMutation,
} from "@/lib/annotations/use-annotations";
import type {
  Annotation,
  DrawAnnotation,
  DrawAnnotationData,
  HighlightAnnotation,
  HighlightAnnotationData,
  TextAnnotation,
  TextAnnotationData,
} from "@/lib/annotations/types";

// ── helpers ───────────────────────────────────────────────────────────────

function strokeToPath(points: [number, number, number][], size = 6): string {
  const stroke = getStroke(points, { size, smoothing: 0.5, thinning: 0.5 });
  if (!stroke.length) return "";
  const d: string[] = [`M ${stroke[0][0]} ${stroke[0][1]}`];
  for (let i = 1; i < stroke.length - 1; i++) {
    const mx = (stroke[i][0] + stroke[i + 1][0]) / 2;
    const my = (stroke[i][1] + stroke[i + 1][1]) / 2;
    d.push(`Q ${stroke[i][0]} ${stroke[i][1]} ${mx} ${my}`);
  }
  d.push("Z");
  return d.join(" ");
}

// Convert a relative (0-1) point to absolute canvas pixels
function relToAbs(rx: number, ry: number, w: number, h: number): [number, number] {
  return [rx * w, ry * h];
}

// Convert absolute canvas pixel to relative (0-1)
function absToRel(ax: number, ay: number, w: number, h: number): [number, number] {
  return [ax / w, ay / h];
}

// ── main component ────────────────────────────────────────────────────────

export function AnnotatedSlideView({ node }: NodeViewProps) {
  const slideKey: string = node.attrs["data-slide-key"] ?? "";
  const src: string = node.attrs.src ?? "";
  const alt: string = node.attrs.alt ?? "";

  // If no slide-key this is a non-annotatable image — render as plain img
  if (!slideKey) {
    return (
      <NodeViewWrapper as="span">
        <img src={src} alt={alt} style={{ width: "100%", height: "auto", display: "block" }} />
      </NodeViewWrapper>
    );
  }

  return <AnnotatedSlideInner slideKey={slideKey} src={src} alt={alt} />;
}

function AnnotatedSlideInner({
  slideKey,
  src,
  alt,
}: {
  slideKey: string;
  src: string;
  alt: string;
}) {
  // Extract noteId from slideKey: "nobi-{noteId}-{idx}"
  const parts = slideKey.split("-");
  // format: nobi-<uuid(5 parts)>-<idx>  → uuid is parts[1..5], idx is parts[6]
  const noteId = parts.slice(1, 6).join("-");

  const { mode, drawColor, highlightColor, drawSize } = useAnnotationContext();
  const { data: allAnnotations = [] } = useAnnotations(noteId);
  const upsertMutation = useUpsertAnnotationMutation(noteId);
  const deleteMutation = useDeleteAnnotationMutation(noteId);

  const slideAnnotations = allAnnotations.filter((a) => a.slideKey === slideKey);
  const highlights = slideAnnotations.filter(
    (a): a is HighlightAnnotation => a.type === "highlight",
  );
  const draws = slideAnnotations.filter((a): a is DrawAnnotation => a.type === "draw");
  const texts = slideAnnotations.filter((a): a is TextAnnotation => a.type === "text");

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Current in-progress draw stroke (local only until pointer-up)
  const [activeStroke, setActiveStroke] = useState<[number, number, number][]>([]);
  // Current in-progress highlight drag
  const [activeHighlight, setActiveHighlight] = useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);

  // ── Canvas: redraw all strokes + active stroke ─────────────────────────
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const w = img.offsetWidth;
    const h = img.offsetHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Draw saved strokes
    for (const ann of draws) {
      const pts = ann.data.points.map(([rx, ry, p]): [number, number, number] => {
        const [ax, ay] = relToAbs(rx, ry, w, h);
        return [ax, ay, p];
      });
      const pathStr = strokeToPath(pts, ann.data.size);
      if (!pathStr) continue;
      const path = new Path2D(pathStr);
      ctx.fillStyle = ann.data.color;
      ctx.fill(path);
    }

    // Draw active stroke
    if (activeStroke.length > 1) {
      const pathStr = strokeToPath(activeStroke, drawSize);
      if (pathStr) {
        const path = new Path2D(pathStr);
        ctx.fillStyle = drawColor;
        ctx.fill(path);
      }
    }
  }, [draws, activeStroke, drawColor]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Resize observer to re-sync canvas on layout changes
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const ro = new ResizeObserver(() => redrawCanvas());
    ro.observe(img);
    return () => ro.disconnect();
  }, [redrawCanvas]);

  // ── Pointer event handlers ─────────────────────────────────────────────
  const getRelativePoint = (e: React.PointerEvent): [number, number, number] => {
    const img = imgRef.current!;
    const rect = img.getBoundingClientRect();
    const ax = e.clientX - rect.left;
    const ay = e.clientY - rect.top;
    const [rx, ry] = absToRel(ax, ay, rect.width, rect.height);
    return [rx, ry, e.pressure || 0.5];
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (mode === "none") return;
    // Prevent Tiptap from receiving this event (cursor positioning, selection, etc.)
    e.nativeEvent.stopImmediatePropagation();
    e.nativeEvent.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getRelativePoint(e);

    if (mode === "draw" || mode === "erase") {
      setActiveStroke([pt]);
    } else if (mode === "highlight") {
      setActiveHighlight({ x0: pt[0], y0: pt[1], x1: pt[0], y1: pt[1] });
    } else if (mode === "text") {
      handlePlaceText(pt[0], pt[1]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (mode === "none") return;
    if (mode === "draw" || mode === "erase") {
      if (activeStroke.length === 0) return;
      const pt = getRelativePoint(e);
      setActiveStroke((prev) => [...prev, pt]);
    } else if (mode === "highlight" && activeHighlight) {
      const pt = getRelativePoint(e);
      setActiveHighlight((prev) => (prev ? { ...prev, x1: pt[0], y1: pt[1] } : null));
    }
  };

  const handlePointerUp = async () => {
    if (mode === "draw" && activeStroke.length > 1) {
      const data: DrawAnnotationData = {
        points: activeStroke,
        color: drawColor,
        size: drawSize,
      };
      await upsertMutation.mutateAsync({
        noteId,
        slideKey,
        type: "draw",
        data: data as unknown as Record<string, unknown>,
      });
    } else if (mode === "erase" && activeStroke.length > 0) {
      // Erase: delete any draw annotation whose first point is near the stroke
      const img = imgRef.current;
      if (!img) return;
      const w = img.offsetWidth;
      const h = img.offsetHeight;
      const erasePts = activeStroke;
      for (const ann of draws) {
        const firstPt = ann.data.points[0];
        const [ax, ay] = relToAbs(firstPt[0], firstPt[1], w, h);
        const isNear = erasePts.some(([rx, ry]) => {
          const [ex, ey] = relToAbs(rx, ry, w, h);
          return Math.hypot(ax - ex, ay - ey) < 20;
        });
        if (isNear) {
          deleteMutation.mutate(ann.id);
        }
      }
    } else if (mode === "highlight" && activeHighlight) {
      const { x0, y0, x1, y1 } = activeHighlight;
      const x = Math.min(x0, x1);
      const y = Math.min(y0, y1);
      const width = Math.abs(x1 - x0);
      const height = Math.abs(y1 - y0);
      if (width > 0.01 && height > 0.005) {
        const data: HighlightAnnotationData = { x, y, width, height, color: highlightColor };
        await upsertMutation.mutateAsync({
          noteId,
          slideKey,
          type: "highlight",
          data: data as unknown as Record<string, unknown>,
        });
      }
    }
    setActiveStroke([]);
    setActiveHighlight(null);
  };

  const handlePlaceText = (rx: number, ry: number) => {
    const data: TextAnnotationData = {
      x: rx,
      y: ry,
      width: 0.3,
      height: 0.1,
      text: "",
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "normal",
      fontStyle: "normal",
    };
    upsertMutation.mutate({
      noteId,
      slideKey,
      type: "text",
      data: data as unknown as Record<string, unknown>,
    });
  };

  const isAnnotating = mode !== "none";

  // Cursor style per mode
  const cursorStyle =
    mode === "draw"
      ? "crosshair"
      : mode === "erase"
        ? "cell"
        : mode === "highlight"
          ? "crosshair"
          : mode === "text"
            ? "text"
            : "default";

  return (
    <NodeViewWrapper
      as="div"
      style={{ position: "relative", userSelect: isAnnotating ? "none" : "auto" }}
    >
      {/* Slide image */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        style={{ width: "100%", height: "auto", display: "block", borderRadius: 4 }}
        draggable={false}
      />

      {/* Annotation overlay — only shown when there are annotations OR we are annotating */}
      {(isAnnotating || slideAnnotations.length > 0) && (
        <div
          ref={containerRef}
          className="annotation-overlay"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: isAnnotating ? "all" : "none",
            cursor: isAnnotating ? cursorStyle : "default",
            touchAction: "none",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Highlight layer */}
          {highlights.map((ann) => (
            <div
              key={ann.id}
              style={{
                position: "absolute",
                left: `${ann.data.x * 100}%`,
                top: `${ann.data.y * 100}%`,
                width: `${ann.data.width * 100}%`,
                height: `${ann.data.height * 100}%`,
                backgroundColor: ann.data.color,
                borderRadius: 2,
                pointerEvents: isAnnotating ? "none" : "all",
              }}
            >
              {isAnnotating && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(ann.id);
                  }}
                  style={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "#EF4444",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 10,
                  }}
                >
                  <XIcon style={{ width: 10, height: 10, color: "#fff" }} />
                </button>
              )}
            </div>
          ))}

          {/* Active highlight preview */}
          {activeHighlight && (
            <div
              style={{
                position: "absolute",
                left: `${Math.min(activeHighlight.x0, activeHighlight.x1) * 100}%`,
                top: `${Math.min(activeHighlight.y0, activeHighlight.y1) * 100}%`,
                width: `${Math.abs(activeHighlight.x1 - activeHighlight.x0) * 100}%`,
                height: `${Math.abs(activeHighlight.y1 - activeHighlight.y0) * 100}%`,
                backgroundColor: highlightColor,
                borderRadius: 2,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Draw canvas */}
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
            }}
          />

          {/* Text box layer */}
          {texts.map((ann) => (
            <TextBox
              key={ann.id}
              ann={ann}
              noteId={noteId}
              slideKey={slideKey}
              isAnnotating={isAnnotating}
              onDelete={() => deleteMutation.mutate(ann.id)}
              onUpdate={(data) =>
                upsertMutation.mutate({
                  id: ann.id,
                  noteId,
                  slideKey,
                  type: "text",
                  data: data as unknown as Record<string, unknown>,
                })
              }
            />
          ))}
        </div>
      )}
    </NodeViewWrapper>
  );
}

// ── TextBox constants ──────────────────────────────────────────────────────

type BoxMode = "idle" | "selected" | "editing";
type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const FONT_SIZE_OPTIONS: { label: string; value: number }[] = [
  { label: "S", value: 11 },
  { label: "M", value: 14 },
  { label: "L", value: 18 },
  { label: "XL", value: 24 },
];

const TEXT_COLORS: { label: string; value: string }[] = [
  { label: "White", value: "#FFFFFF" },
  { label: "Black", value: "#000000" },
  { label: "Red", value: "#EF4444" },
  { label: "Blue", value: "#3B82F6" },
  { label: "Green", value: "#22C55E" },
  { label: "Yellow", value: "#EAB308" },
  { label: "Violet", value: "#7C3AED" },
];

const RESIZE_HANDLES: { handle: ResizeHandle; style: React.CSSProperties }[] = [
  { handle: "nw", style: { top: -4, left: -4, cursor: "nw-resize" } },
  { handle: "n", style: { top: -4, left: "calc(50% - 4px)", cursor: "n-resize" } },
  { handle: "ne", style: { top: -4, right: -4, cursor: "ne-resize" } },
  { handle: "e", style: { top: "calc(50% - 4px)", right: -4, cursor: "e-resize" } },
  { handle: "se", style: { bottom: -4, right: -4, cursor: "se-resize" } },
  { handle: "s", style: { bottom: -4, left: "calc(50% - 4px)", cursor: "s-resize" } },
  { handle: "sw", style: { bottom: -4, left: -4, cursor: "sw-resize" } },
  { handle: "w", style: { top: "calc(50% - 4px)", left: -4, cursor: "w-resize" } },
];

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ── TextBox sub-component ─────────────────────────────────────────────────

function TextBox({
  ann,
  isAnnotating,
  onDelete,
  onUpdate,
}: {
  ann: TextAnnotation;
  noteId: string;
  slideKey: string;
  isAnnotating: boolean;
  onDelete: () => void;
  onUpdate: (data: TextAnnotationData) => void;
}) {
  // New boxes (empty text) start in editing mode; existing ones start idle
  const [boxMode, setBoxMode] = useState<BoxMode>(!ann.data.text ? "editing" : "idle");
  const [localText, setLocalText] = useState(ann.data.text);

  // Refs so stable closures (event listeners) always see fresh values
  const localTextRef = useRef(ann.data.text);
  const annDataRef = useRef(ann.data);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localTextRef.current = localText;
  }, [localText]);
  useEffect(() => {
    annDataRef.current = ann.data;
  }, [ann.data]);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);
  useEffect(() => {
    onDeleteRef.current = onDelete;
  }, [onDelete]);

  // Sync text from Supabase when not currently editing
  useEffect(() => {
    if (boxMode !== "editing") setLocalText(ann.data.text);
  }, [ann.data.text, boxMode]);

  // Autofocus when entering editing mode
  useEffect(() => {
    if (boxMode === "editing") {
      const t = setTimeout(() => textareaRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [boxMode]);

  // Click-outside dismissal — added via setTimeout so the triggering click isn't caught
  useEffect(() => {
    if (boxMode === "idle" || !isAnnotating) return;

    let removeHandler: (() => void) | null = null;
    const tid = setTimeout(() => {
      const handler = (e: PointerEvent) => {
        if (!containerRef.current?.contains(e.target as Node)) {
          if (boxMode === "editing") {
            onUpdateRef.current({ ...annDataRef.current, text: localTextRef.current });
          }
          setBoxMode("idle");
        }
      };
      window.addEventListener("pointerdown", handler);
      removeHandler = () => window.removeEventListener("pointerdown", handler);
    }, 0);

    return () => {
      clearTimeout(tid);
      removeHandler?.();
    };
  }, [boxMode, isAnnotating]);

  // ── Border pointer down: select → or drag ────────────────────────────
  const handleBorderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isAnnotating) return;
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    e.nativeEvent.preventDefault();

    if (boxMode === "idle") {
      setBoxMode("selected");
      return;
    }

    if (boxMode === "selected") {
      // Start drag with pointer capture on the container element
      const el = containerRef.current!;
      const parent = el.parentElement!;
      const pRect = parent.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const ox = e.clientX - eRect.left;
      const oy = e.clientY - eRect.top;
      el.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const pR = parent.getBoundingClientRect();
        const x = clamp((ev.clientX - ox - pR.left) / pR.width, 0, 1 - annDataRef.current.width);
        const y = clamp((ev.clientY - oy - pR.top) / pR.height, 0, 0.95);
        el.style.left = `${x * 100}%`;
        el.style.top = `${y * 100}%`;
      };
      const onUp = (ev: PointerEvent) => {
        const pR = parent.getBoundingClientRect();
        const x = clamp((ev.clientX - ox - pR.left) / pR.width, 0, 1 - annDataRef.current.width);
        const y = clamp((ev.clientY - oy - pR.top) / pR.height, 0, 0.95);
        onUpdateRef.current({ ...annDataRef.current, text: localTextRef.current, x, y });
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!isAnnotating) return;
    e.stopPropagation();
    setBoxMode("editing");
  };

  // ── Resize handles ────────────────────────────────────────────────────
  const startResize = (e: React.PointerEvent<HTMLDivElement>, handle: ResizeHandle) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    e.nativeEvent.preventDefault();

    const handleEl = e.currentTarget;
    const el = containerRef.current!;
    const parent = el.parentElement!;
    const pRect = parent.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    // Capture start coords in relative (0-1) space from actual DOM measurements
    // so we don't rely on potentially stale ann.data values during a drag
    const sX = (elRect.left - pRect.left) / pRect.width;
    const sY = (elRect.top - pRect.top) / pRect.height;
    const sW = elRect.width / pRect.width;
    const sH = elRect.height / pRect.height;
    const sPX = e.clientX;
    const sPY = e.clientY;

    handleEl.setPointerCapture(e.pointerId);

    const compute = (ev: PointerEvent) => {
      const dx = (ev.clientX - sPX) / pRect.width;
      const dy = (ev.clientY - sPY) / pRect.height;
      let x = sX,
        y = sY,
        w = sW,
        h = sH;
      if (handle.includes("w")) {
        x = sX + dx;
        w = Math.max(0.05, sW - dx);
      }
      if (handle.includes("e")) {
        w = Math.max(0.05, sW + dx);
      }
      if (handle.includes("n")) {
        y = sY + dy;
        h = Math.max(0.03, sH - dy);
      }
      if (handle.includes("s")) {
        h = Math.max(0.03, sH + dy);
      }
      return { x, y, w, h };
    };

    const onMove = (ev: PointerEvent) => {
      const { x, y, w, h } = compute(ev);
      el.style.left = `${x * 100}%`;
      el.style.top = `${y * 100}%`;
      el.style.width = `${w * 100}%`;
      el.style.height = `${h * 100}%`;
    };
    const onUp = (ev: PointerEvent) => {
      const { x, y, w, h } = compute(ev);
      onUpdateRef.current({
        ...annDataRef.current,
        text: localTextRef.current,
        x,
        y,
        width: w,
        height: h,
      });
      handleEl.removeEventListener("pointermove", onMove);
      handleEl.removeEventListener("pointerup", onUp);
    };
    handleEl.addEventListener("pointermove", onMove);
    handleEl.addEventListener("pointerup", onUp);
  };

  // ── Derived display values ────────────────────────────────────────────
  const isSelected = boxMode === "selected" || boxMode === "editing";
  const isEditing = boxMode === "editing";
  const toolbarAbove = ann.data.y > 0.12; // enough room above; else show below

  const borderStyle = isEditing
    ? "1.5px dashed rgba(124,58,237,0.9)"
    : isSelected
      ? "1.5px solid rgba(124,58,237,0.9)"
      : isAnnotating
        ? "1px solid rgba(124,58,237,0.25)"
        : "1px solid transparent";

  return (
    <div
      ref={containerRef}
      onPointerDown={handleBorderPointerDown}
      onDoubleClick={handleDoubleClick}
      style={{
        position: "absolute",
        left: `${ann.data.x * 100}%`,
        top: `${ann.data.y * 100}%`,
        width: `${ann.data.width * 100}%`,
        height: ann.data.height != null ? `${ann.data.height * 100}%` : undefined,
        zIndex: isSelected ? 10 : 5,
        cursor: isEditing ? "text" : isSelected ? "grab" : isAnnotating ? "pointer" : "default",
        pointerEvents: isAnnotating ? "all" : "none",
      }}
    >
      {/* ── Floating toolbar ─────────────────────────────────────────── */}
      {isSelected && (
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
          style={{
            position: "absolute",
            ...(toolbarAbove ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" }),
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            gap: 3,
            background: "rgba(22,22,28,0.98)",
            border: "1px solid rgba(124,58,237,0.35)",
            borderRadius: 8,
            padding: "4px 6px",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
          }}
        >
          {/* Font sizes */}
          {FONT_SIZE_OPTIONS.map(({ label, value }) => {
            const active = ann.data.fontSize === value;
            return (
              <button
                key={value}
                type="button"
                title={`${label} (${value}px)`}
                onClick={() =>
                  onUpdateRef.current({
                    ...annDataRef.current,
                    text: localTextRef.current,
                    fontSize: value,
                  })
                }
                style={{
                  minWidth: 24,
                  height: 24,
                  borderRadius: 4,
                  border: active ? "1px solid rgba(124,58,237,0.5)" : "1px solid transparent",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 600,
                  background: active ? "rgba(124,58,237,0.25)" : "transparent",
                  color: active ? "#A78BFA" : "#888",
                  padding: "0 3px",
                }}
              >
                {label}
              </button>
            );
          })}

          <span
            style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 3px" }}
          />

          {/* Text color swatches */}
          {TEXT_COLORS.map(({ label, value }) => {
            const active = ann.data.color === value;
            return (
              <button
                key={value}
                type="button"
                title={label}
                onClick={() =>
                  onUpdateRef.current({
                    ...annDataRef.current,
                    text: localTextRef.current,
                    color: value,
                  })
                }
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: value,
                  border: active ? "2px solid #A78BFA" : "1.5px solid rgba(255,255,255,0.18)",
                  cursor: "pointer",
                  outline: active ? "1px solid rgba(124,58,237,0.6)" : "none",
                  outlineOffset: 1,
                }}
              />
            );
          })}

          <span
            style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 3px" }}
          />

          {/* Bold */}
          {(() => {
            const active = ann.data.fontWeight === "bold";
            return (
              <button
                type="button"
                title="Bold"
                onClick={() =>
                  onUpdateRef.current({
                    ...annDataRef.current,
                    text: localTextRef.current,
                    fontWeight: active ? "normal" : "bold",
                  })
                }
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  border: active ? "1px solid rgba(124,58,237,0.5)" : "1px solid transparent",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  background: active ? "rgba(124,58,237,0.25)" : "transparent",
                  color: active ? "#A78BFA" : "#888",
                }}
              >
                B
              </button>
            );
          })()}

          {/* Italic */}
          {(() => {
            const active = ann.data.fontStyle === "italic";
            return (
              <button
                type="button"
                title="Italic"
                onClick={() =>
                  onUpdateRef.current({
                    ...annDataRef.current,
                    text: localTextRef.current,
                    fontStyle: active ? "normal" : "italic",
                  })
                }
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  border: active ? "1px solid rgba(124,58,237,0.5)" : "1px solid transparent",
                  cursor: "pointer",
                  fontSize: 13,
                  fontStyle: "italic",
                  fontWeight: 600,
                  background: active ? "rgba(124,58,237,0.25)" : "transparent",
                  color: active ? "#A78BFA" : "#888",
                }}
              >
                I
              </button>
            );
          })()}

          <span
            style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 3px" }}
          />

          {/* Delete */}
          <button
            type="button"
            title="Delete text box"
            onClick={() => onDeleteRef.current()}
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              border: "1px solid transparent",
              cursor: "pointer",
              background: "transparent",
              color: "#EF4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <XIcon style={{ width: 12, height: 12 }} />
          </button>
        </div>
      )}

      {/* ── Box frame ────────────────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          height: "100%",
          border: borderStyle,
          borderRadius: 4,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
          overflow: "hidden",
        }}
      >
        <textarea
          ref={textareaRef}
          value={localText}
          onChange={(e) => {
            setLocalText(e.target.value);
            localTextRef.current = e.target.value;
          }}
          onBlur={() => {
            onUpdateRef.current({ ...annDataRef.current, text: localTextRef.current });
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            // Single click into textarea while selected → enter editing mode
            if (boxMode === "selected") setBoxMode("editing");
          }}
          readOnly={!isEditing}
          style={{
            display: "block",
            width: "100%",
            height: ann.data.height != null ? "100%" : undefined,
            minHeight: "2em",
            resize: "none",
            background: "transparent",
            border: "none",
            outline: "none",
            color: ann.data.color,
            fontSize: ann.data.fontSize,
            fontWeight: ann.data.fontWeight ?? "normal",
            fontStyle: ann.data.fontStyle ?? "normal",
            padding: "4px 6px",
            lineHeight: 1.4,
            fontFamily: "inherit",
            cursor: isEditing ? "text" : "inherit",
            pointerEvents: isEditing ? "all" : "none",
            overflowY: "auto",
          }}
        />

        {/* ── Resize handles (visible when selected or editing) ─────── */}
        {isSelected &&
          RESIZE_HANDLES.map(({ handle, style }) => (
            <div
              key={handle}
              onPointerDown={(e) => startResize(e, handle)}
              style={{
                position: "absolute",
                width: 8,
                height: 8,
                background: "#FFFFFF",
                border: "1.5px solid rgba(124,58,237,0.85)",
                borderRadius: 1,
                zIndex: 15,
                ...style,
              }}
            />
          ))}
      </div>
    </div>
  );
}
