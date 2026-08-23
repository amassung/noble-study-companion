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
  { label: "White", value: "#f4f4f5" },
  { label: "Blue", value: "#2563eb" },
  { label: "Red", value: "#dc2626" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Green", value: "#059669" },
] as const;

export const HIGHLIGHT_INK_COLORS = [
  { label: "Yellow", value: "#fde047" },
  { label: "Green", value: "#86efac" },
  { label: "Pink", value: "#f9a8d4" },
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
        "flex h-[34px] min-w-[34px] items-center justify-center rounded-lg transition-colors",
        mode === value
          ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/25"
          : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border/40 bg-[var(--surface-elevated)]/95 px-3 py-2 backdrop-blur-sm sm:px-5">
      <Tool value="off" icon={<MousePointer2 className="h-4 w-4" />} label="Select / type" />
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

      {mode !== "off" && mode !== "eraser" && (
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
  );
}
