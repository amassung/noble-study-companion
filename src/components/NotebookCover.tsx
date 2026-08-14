import { BookOpen, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOTEBOOK_COLORS, type StoredNotebook } from "@/lib/notebooks/types";

type Props = {
  notebook: StoredNotebook;
  noteCount: number;
  style?: React.CSSProperties;
  onOpen: (id: string) => void;
  onDelete?: (id: string) => void;
  editMode?: boolean;
};

export function NotebookCover({
  notebook,
  noteCount,
  style,
  onOpen,
  onDelete,
  editMode = false,
}: Props) {
  const c = NOTEBOOK_COLORS.find((x) => x.value === notebook.color) ?? NOTEBOOK_COLORS[0];

  return (
    <div style={style} className={`relative animate-float-in ${editMode ? "note-wiggle" : ""}`}>
      {/* Edit-mode delete badge */}
      {editMode && onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notebook.id);
          }}
          aria-label={`Delete ${notebook.name}`}
          className="absolute -left-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow-lg ring-2 ring-background transition-transform active:scale-90"
        >
          <Trash2 className="h-3 w-3" strokeWidth={2.5} />
        </button>
      )}

      <button
        type="button"
        onClick={() => !editMode && onOpen(notebook.id)}
        className={cn(
          "group relative flex w-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-[var(--surface)] p-5 text-left shadow-card transition-all duration-200",
          editMode
            ? "cursor-default opacity-80"
            : "hover-glow cursor-pointer hover:-translate-y-0.5",
        )}
      >
        {/* Coloured left bar */}
        <span
          className={`absolute inset-y-3 left-0 w-[3px] rounded-full bg-gradient-to-b ${c.bar} opacity-80 group-hover:opacity-100`}
        />

        {/* Emoji */}
        <span className="mb-3 text-3xl leading-none">{notebook.emoji}</span>

        {/* Name */}
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-foreground">
          {notebook.name || <span className="text-muted-foreground">Untitled notebook</span>}
        </h3>

        {/* Meta row */}
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className={cn("text-[11.5px] font-medium", c.text)}>
            {noteCount} {noteCount === 1 ? "note" : "notes"}
          </span>
          <BookOpen className={cn("h-3.5 w-3.5 opacity-50", c.text)} />
        </div>
      </button>
    </div>
  );
}

// ── "All Notes" virtual cover ─────────────────────────────────────────────────

type VirtualCoverProps = {
  label: string;
  emoji: string;
  noteCount: number;
  style?: React.CSSProperties;
  onOpen: () => void;
  bar?: string;
};

export function VirtualNotebookCover({
  label,
  emoji,
  noteCount,
  style,
  onOpen,
  bar = "from-primary to-secondary",
}: VirtualCoverProps) {
  return (
    <div style={style} className="animate-float-in">
      <button
        type="button"
        onClick={onOpen}
        className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-[var(--surface)] p-5 text-left shadow-card transition-all duration-200 hover-glow cursor-pointer hover:-translate-y-0.5"
      >
        <span
          className={`absolute inset-y-3 left-0 w-[3px] rounded-full bg-gradient-to-b ${bar} opacity-80 group-hover:opacity-100`}
        />
        <span className="mb-3 text-3xl leading-none">{emoji}</span>
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-foreground">
          {label}
        </h3>
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-[11.5px] font-medium text-primary">
            {noteCount} {noteCount === 1 ? "note" : "notes"}
          </span>
          <BookOpen className="h-3.5 w-3.5 text-primary opacity-50" />
        </div>
      </button>
    </div>
  );
}
