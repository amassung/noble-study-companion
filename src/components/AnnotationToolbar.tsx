/**
 * AnnotationToolbar — sticky strip shown below the Tiptap formatting toolbar
 * when the note contains at least one annotatable slide.
 *
 * Modes: Cursor (none) / Text / Draw / Highlight / Erase
 * Draw sub-controls: color picker, stroke size
 * Highlight sub-controls: color picker
 */
import { MousePointer2, Type, Pen, Highlighter, Eraser } from "lucide-react";
import {
  useAnnotationContext,
  DRAW_COLORS,
  HIGHLIGHT_COLORS,
  type AnnotationMode,
} from "./AnnotationContext";
import { cn } from "@/lib/utils";

interface ModeBtn {
  mode: AnnotationMode;
  icon: React.ReactNode;
  label: string;
}

const MODE_BTNS: ModeBtn[] = [
  { mode: "none", icon: <MousePointer2 className="h-3.5 w-3.5" />, label: "Select" },
  { mode: "text", icon: <Type className="h-3.5 w-3.5" />, label: "Text" },
  { mode: "draw", icon: <Pen className="h-3.5 w-3.5" />, label: "Draw" },
  { mode: "highlight", icon: <Highlighter className="h-3.5 w-3.5" />, label: "Highlight" },
  { mode: "erase", icon: <Eraser className="h-3.5 w-3.5" />, label: "Erase" },
];

export function AnnotationToolbar() {
  const {
    mode,
    setMode,
    drawColor,
    setDrawColor,
    highlightColor,
    setHighlightColor,
    drawSize,
    setDrawSize,
  } = useAnnotationContext();

  return (
    <div className="sticky top-[96px] z-10 flex flex-wrap items-center gap-2 border-b border-violet-500/20 bg-[var(--surface-elevated)]/95 px-3 py-2 backdrop-blur-sm sm:px-5">
      {/* Mode buttons */}
      <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-[var(--surface)] p-0.5">
        {MODE_BTNS.map(({ mode: m, icon, label }) => (
          <button
            key={m}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "flex min-h-[30px] min-w-[30px] items-center justify-center rounded-md px-2 text-[12px] font-medium transition-colors gap-1",
              mode === m
                ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
            )}
          >
            {icon}
            <span className="hidden sm:inline text-[11px]">{label}</span>
          </button>
        ))}
      </div>

      {/* Draw sub-controls */}
      {mode === "draw" && (
        <div className="flex items-center gap-2">
          {/* Color swatches */}
          <div className="flex items-center gap-1">
            {DRAW_COLORS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => setDrawColor(value)}
                className={cn(
                  "h-5 w-5 rounded-full border-2 transition-transform",
                  drawColor === value
                    ? "border-primary scale-110 shadow-glow"
                    : "border-border/60 hover:scale-110",
                )}
                style={{ background: value }}
              />
            ))}
          </div>

          {/* Stroke size */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Size</span>
            <input
              type="range"
              min={2}
              max={12}
              value={drawSize}
              onChange={(e) => setDrawSize(Number(e.target.value))}
              className="h-1 w-16 accent-primary cursor-pointer"
            />
            <span className="text-[11px] text-muted-foreground w-4">{drawSize}</span>
          </div>
        </div>
      )}

      {/* Highlight sub-controls */}
      {mode === "highlight" && (
        <div className="flex items-center gap-1">
          {HIGHLIGHT_COLORS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => setHighlightColor(value)}
              className={cn(
                "h-5 w-20 rounded border-2 text-[10px] font-medium transition-transform",
                highlightColor === value
                  ? "border-primary scale-105"
                  : "border-border/60 hover:scale-105",
              )}
              style={{ background: value }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Mode hint */}
      {mode !== "none" && (
        <span className="ml-auto text-[11px] text-muted-foreground hidden sm:block">
          {mode === "text" && "Click on slide to place a text box"}
          {mode === "draw" && "Draw freehand on slides"}
          {mode === "highlight" && "Drag to highlight an area"}
          {mode === "erase" && "Draw over strokes to erase them"}
        </span>
      )}
    </div>
  );
}
