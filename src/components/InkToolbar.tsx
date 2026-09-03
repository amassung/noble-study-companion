import {
  Eraser,
  Highlighter,
  MousePointer2,
  Pen,
  PenLine,
  Pencil,
  Redo2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import type { InkMode } from "@/components/InkCanvas";

export const INK_COLORS = [
  { label: "Black", value: "#1f2937" },
  { label: "Graphite", value: "#6b7280" },
  { label: "White", value: "#f4f4f5" },
  { label: "Blue", value: "#2563eb" },
  { label: "Navy", value: "#1e3a8a" },
  { label: "Teal", value: "#0d9488" },
  { label: "Green", value: "#059669" },
  { label: "Lime", value: "#65a30d" },
  { label: "Amber", value: "#d97706" },
  { label: "Orange", value: "#ea580c" },
  { label: "Red", value: "#dc2626" },
  { label: "Crimson", value: "#be123c" },
  { label: "Pink", value: "#db2777" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Indigo", value: "#4f46e5" },
  { label: "Brown", value: "#78350f" },
] as const;

export const HIGHLIGHT_INK_COLORS = [
  { label: "Yellow", value: "#fde047" },
  { label: "Green", value: "#86efac" },
  { label: "Pink", value: "#f9a8d4" },
  { label: "Blue", value: "#93c5fd" },
  { label: "Orange", value: "#fdba74" },
  { label: "Violet", value: "#d8b4fe" },
] as const;

/** Eraser tip radius in page px — fine enough for one letter, broad enough
 *  to clear a line without repeated passes. */
export const ERASER_SIZES = [
  { label: "Fine", value: 10 },
  { label: "Medium", value: 24 },
  { label: "Broad", value: 52 },
] as const;

export const PEN_SIZES = [
  { label: "Fine", value: 2.5 },
  { label: "Medium", value: 5 },
  { label: "Bold", value: 9 },
] as const;

/**
 * Handwriting toolbar — tool, colour, and nib size for the page ink canvas.
 * Shown above the page; "Select" returns to normal typing.
 */
export function InkToolbar({
  mode,
  setMode,
  color,
  setColor,
  size,
  setSize,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  setZoom,
  minZoom,
  eraserSize,
  setEraserSize,
}: {
  mode: InkMode;
  setMode: (m: InkMode) => void;
  color: string;
  setColor: (c: string) => void;
  size: number;
  setSize: (s: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  setZoom: (z: number) => void;
  /** Floor for zooming out — the scale that fits a whole page on screen. */
  minZoom: number;
  eraserSize: number;
  setEraserSize: (s: number) => void;
}) {
  const palette = mode === "highlighter" ? HIGHLIGHT_INK_COLORS : INK_COLORS;

  // Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z, the shortcuts a GoodNotes user already
  // has in muscle memory. Bound while the ink toolbar is mounted (i.e. while
  // handwriting) so they don't fight the text editor's own undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) {
        if (canRedo) onRedo();
      } else if (canUndo) {
        onUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUndo, onRedo, canUndo, canRedo]);

  const Tool = ({
    value,
    icon,
    label,
  }: {
    value: InkMode;
    icon: React.ReactNode;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      title={label}
      aria-label={label}
      aria-pressed={mode === value}
      className={cn(
        "flex h-[38px] min-w-[38px] items-center justify-center rounded-xl transition-colors",
        mode === value
          ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/25"
          : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );

  return (
    <div className="pointer-events-none sticky top-2 z-30 flex justify-center px-2">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-2xl border border-black/[0.06] bg-[var(--surface-elevated)]/85 px-2 py-1.5 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.35)] ring-1 ring-inset ring-white/40 backdrop-blur-xl">
        {/* A floating palette, not a page header.
        Edge-to-edge bars with hairline borders read as browser chrome, which
        is what made this feel like a website rather than an iPad app. Lifting
        it into a rounded, shadowed island over the page is most of what
        separates the two. */}
        <Tool value="select" icon={<MousePointer2 className="h-4 w-4" />} label="Select" />
        <Tool value="pen" icon={<Pen className="h-4 w-4" />} label="Pen" />
        <Tool value="pencil" icon={<Pencil className="h-4 w-4" />} label="Pencil" />
        <Tool value="fineliner" icon={<PenLine className="h-4 w-4" />} label="Fine point" />
        <Tool value="highlighter" icon={<Highlighter className="h-4 w-4" />} label="Highlighter" />
        <Tool value="eraser" icon={<Eraser className="h-4 w-4" />} label="Eraser" />

        <span className="mx-1 h-6 w-px shrink-0 rounded-full bg-border/60" />

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (⌘Z)"
          aria-label="Undo"
          className="flex h-[34px] min-w-[34px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (⇧⌘Z)"
          aria-label="Redo"
          className="flex h-[34px] min-w-[34px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <span className="mx-1 h-6 w-px shrink-0 rounded-full bg-border/60" />

        {/* Zoom — pinch works too, but a button is needed on a laptop and for
          anyone who wants an exact reset. */}
        <button
          type="button"
          onClick={() => setZoom(Math.max(minZoom, Math.round((zoom - 0.25) * 100) / 100))}
          disabled={zoom <= minZoom}
          title="Zoom out"
          aria-label="Zoom out"
          className="flex h-[34px] min-w-[34px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          title="Reset zoom"
          aria-label="Reset zoom"
          className="flex h-[34px] min-w-[46px] items-center justify-center rounded-lg text-[11.5px] font-medium tabular-nums text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setZoom(Math.min(3, Math.round((zoom + 0.25) * 100) / 100))}
          disabled={zoom >= 3}
          title="Zoom in"
          aria-label="Zoom in"
          className="flex h-[34px] min-w-[34px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        {/* Colour and nib size mean nothing for the arrow or the eraser. */}
        {mode === "eraser" && (
          <>
            <span className="mx-1 h-6 w-px shrink-0 rounded-full bg-border/60" />
            {ERASER_SIZES.map((e) => (
              <button
                key={e.label}
                type="button"
                onClick={() => setEraserSize(e.value)}
                title={`${e.label} eraser`}
                aria-label={`${e.label} eraser`}
                aria-pressed={eraserSize === e.value}
                className={cn(
                  "flex h-[34px] min-w-[34px] items-center justify-center rounded-lg transition-colors",
                  eraserSize === e.value
                    ? "bg-primary/15 ring-1 ring-inset ring-primary/25"
                    : "hover:bg-white/[0.06]",
                )}
              >
                <span
                  className="rounded-full border"
                  style={{
                    // Scaled down to fit the toolbar while keeping the sizes
                    // visibly different from one another.
                    width: `${Math.round(e.value / 2.6) + 8}px`,
                    height: `${Math.round(e.value / 2.6) + 8}px`,
                    borderColor:
                      eraserSize === e.value ? "var(--primary)" : "var(--muted-foreground)",
                  }}
                />
              </button>
            ))}
          </>
        )}

        {mode !== "off" && mode !== "eraser" && mode !== "select" && (
          <>
            <span className="mx-1 h-6 w-px shrink-0 rounded-full bg-border/60" />
            {palette.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                title={c.label}
                aria-label={c.label}
                aria-pressed={color === c.value}
                className={cn(
                  "h-6 w-6 rounded-full border transition-transform",
                  color === c.value
                    ? "scale-110 border-primary ring-2 ring-primary/40"
                    : "border-border/60 hover:scale-105",
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}

            {/* Any other colour.
              A native colour input is deliberate: on iPad it opens the system
              picker — wheel, spectrum and sliders — which is a better tool
              than anything hand-rolled here, and it costs no custom UI. */}
            <label
              title="Custom colour"
              className={cn(
                "relative h-6 w-6 shrink-0 cursor-pointer rounded-full border transition-transform hover:scale-105",
                palette.some((c) => c.value === color)
                  ? "border-border/60"
                  : "scale-110 border-primary ring-2 ring-primary/40",
              )}
              style={{
                background: palette.some((c) => c.value === color)
                  ? "conic-gradient(#dc2626,#d97706,#65a30d,#0d9488,#2563eb,#7c3aed,#db2777,#dc2626)"
                  : color,
              }}
            >
              <input
                type="color"
                value={color}
                aria-label="Custom colour"
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>

            <span className="mx-1 h-6 w-px shrink-0 rounded-full bg-border/60" />
            {PEN_SIZES.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setSize(s.value)}
                title={s.label}
                aria-label={s.label}
                aria-pressed={size === s.value}
                className={cn(
                  "flex h-[34px] min-w-[34px] items-center justify-center rounded-lg transition-colors",
                  size === s.value
                    ? "bg-primary/15 ring-1 ring-inset ring-primary/25"
                    : "hover:bg-white/[0.06]",
                )}
              >
                <span
                  className="rounded-full bg-current"
                  style={{
                    width: `${s.value + 2}px`,
                    height: `${s.value + 2}px`,
                    color: size === s.value ? "var(--primary)" : "var(--muted-foreground)",
                  }}
                />
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
