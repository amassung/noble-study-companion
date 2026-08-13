import { Eraser, Highlighter, MousePointer2, Pen } from "lucide-react";
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
}: {
  mode: InkMode;
  setMode: (m: InkMode) => void;
  color: string;
  setColor: (c: string) => void;
  size: number;
  setSize: (s: number) => void;
}) {
  const palette = mode === "highlighter" ? HIGHLIGHT_INK_COLORS : INK_COLORS;

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
      <Tool value="highlighter" icon={<Highlighter className="h-4 w-4" />} label="Highlighter" />
      <Tool value="eraser" icon={<Eraser className="h-4 w-4" />} label="Eraser" />

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
