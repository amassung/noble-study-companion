import { Sparkles, Trash2, CalendarClock } from "lucide-react";
import { useRef, useState } from "react";
import { daysUntil, formatTestCountdown } from "@/lib/notes/format";

export type Subject = "violet" | "blue" | "green" | "amber";

const subjectStyles: Record<Subject, { bg: string; text: string; ring: string; label: string; bar: string }> = {
  violet: {
    bg: "bg-primary/15",
    text: "text-primary",
    ring: "ring-primary/30",
    label: "Philosophy",
    bar: "from-primary to-secondary",
  },
  blue: {
    bg: "bg-sky-500/15",
    text: "text-sky-300",
    ring: "ring-sky-400/30",
    label: "Biology",
    bar: "from-sky-400 to-cyan-400",
  },
  green: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    ring: "ring-emerald-400/30",
    label: "Economics",
    bar: "from-emerald-400 to-teal-400",
  },
  amber: {
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    ring: "ring-amber-400/30",
    label: "History",
    bar: "from-amber-400 to-orange-400",
  },
};

export type Note = {
  id: string;
  subject: Subject;
  subjectLabel?: string;
  title: string;
  preview: string;
  date: string;
  guideReady?: boolean;
  testDate?: number | null;
};

type Props = {
  note: Note;
  style?: React.CSSProperties;
  onOpen?: (id: string) => void;
  onDelete?: (id: string) => void;
};

const SWIPE_THRESHOLD = 96;

export function NoteCard({ note, style, onOpen, onDelete }: Props) {
  const s = subjectStyles[note.subject];
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const movedAxis = useRef<"x" | "y" | null>(null);

  const reset = () => {
    setDragging(false);
    setDragX(0);
    startX.current = null;
    startY.current = null;
    movedAxis.current = null;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (!onDelete) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    movedAxis.current = null;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!onDelete || startX.current == null || startY.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (movedAxis.current == null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      movedAxis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (movedAxis.current === "x") {
      if (!dragging) setDragging(true);
      setDragX(Math.min(0, dx)); // only left-swipe deletes
    }
  };

  const onTouchEnd = () => {
    if (!onDelete) return;
    if (movedAxis.current === "x" && Math.abs(dragX) > SWIPE_THRESHOLD) {
      setRemoving(true);
      setDragX(-window.innerWidth);
      setTimeout(() => onDelete(note.id), 200);
      return;
    }
    reset();
  };

  const handleClick = () => {
    if (Math.abs(dragX) > 6) return; // ignore click after drag
    onOpen?.(note.id);
  };

  return (
    <div
      style={style}
      className="relative overflow-hidden rounded-xl animate-float-in"
    >
      {/* Delete background (revealed on swipe) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-end rounded-xl bg-gradient-to-l from-destructive/90 to-destructive/40 pr-6 text-destructive-foreground"
        style={{ opacity: Math.min(1, Math.abs(dragX) / SWIPE_THRESHOLD) }}
      >
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Trash2 className="h-4 w-4" />
          {Math.abs(dragX) > SWIPE_THRESHOLD ? "Release to delete" : "Swipe to delete"}
        </div>
      </div>

      <article
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={handleClick}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging && !removing ? "none" : "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
        className="hover-glow group relative cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-[var(--surface)] p-5 shadow-card transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 touch-pan-y"
      >
        <span className={`absolute inset-y-3 left-0 w-[3px] rounded-full bg-gradient-to-b ${s.bar} opacity-80 group-hover:opacity-100`} />

        <div className="flex items-start justify-between gap-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${s.bg} ${s.text} ${s.ring}`}
          >
            {note.subjectLabel ?? s.label}
          </span>
          {note.guideReady && (
            <span
              title="Study guide ready"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30"
            >
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
            </span>
          )}
        </div>

        <h3 className="mt-3 line-clamp-1 text-[15px] font-semibold tracking-tight text-foreground">
          {note.title || <span className="text-muted-foreground">Untitled note</span>}
        </h3>
        <p className="mt-1.5 line-clamp-2 min-h-[2.6em] text-[13px] leading-relaxed text-muted-foreground">
          {note.preview || <span className="opacity-60">No content yet — tap to start writing.</span>}
        </p>

        {note.testDate != null && (() => {
          const d = daysUntil(note.testDate);
          const urgent = d <= 2 && d >= 0;
          const past = d < 0;
          return (
            <div
              className={[
                "mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium ring-1 ring-inset",
                past
                  ? "bg-white/[0.04] text-muted-foreground ring-white/[0.06]"
                  : urgent
                    ? "bg-primary/15 text-primary ring-primary/30 shadow-glow"
                    : "bg-primary/10 text-primary ring-primary/25",
              ].join(" ")}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              {formatTestCountdown(note.testDate, note.subjectLabel ?? s.label)}
            </div>
          );
        })()}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11.5px] text-muted-foreground">{note.date}</span>
          <span className="text-[11.5px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Open →
          </span>
        </div>
      </article>
    </div>
  );
}
