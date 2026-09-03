import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOTEBOOK_COLORS, type StoredNotebook } from "@/lib/notebooks/types";

/**
 * A notebook on the shelf.
 *
 * Drawn as a book rather than a list row: a portrait cover in the notebook's
 * own colour, with a spine down the left edge and the title set underneath
 * the way a shelf reads. Students pick a notebook by recognising it, not by
 * reading it — the emoji and colour they chose at creation are the whole
 * identity, so the cover has to be the thing that carries them.
 */

/** The cover art itself, shared by real notebooks and the virtual ones. */
function Cover({ emoji, bar, className }: { emoji: string; bar: string; className?: string }) {
  return (
    <span
      className={cn(
        "relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg rounded-l-[5px] shadow-[0_10px_28px_-12px_rgba(0,0,0,0.55)] ring-1 ring-black/10 transition-transform duration-200",
        "bg-gradient-to-br",
        bar,
        className,
      )}
    >
      {/* Spine: a darker band with a highlight down its inner edge, which is
          what stops the cover reading as a plain coloured rectangle. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[13%] bg-black/20 shadow-[inset_-1px_0_0_rgba(255,255,255,0.22)]"
      />
      {/* Page block peeking out along the fore-edge. */}
      <span
        aria-hidden
        className="absolute inset-y-[3%] right-0 w-[3px] rounded-r-sm bg-white/70"
      />
      {/* A soft sheen across the top corner. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/10"
      />
      <span className="relative translate-x-[5%] text-[clamp(1.75rem,4.5vw,2.5rem)] leading-none drop-shadow-sm">
        {emoji}
      </span>
    </span>
  );
}

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
          "group flex w-full flex-col text-left",
          editMode ? "cursor-default opacity-80" : "cursor-pointer",
        )}
      >
        <Cover
          emoji={notebook.emoji}
          bar={c.bar}
          className={editMode ? undefined : "group-hover:-translate-y-1"}
        />

        <h3 className="mt-2.5 line-clamp-2 text-[13.5px] font-semibold leading-snug tracking-tight text-foreground">
          {notebook.name || <span className="text-muted-foreground">Untitled notebook</span>}
        </h3>
        <span className="mt-0.5 text-[11.5px] text-muted-foreground">
          {noteCount} {noteCount === 1 ? "note" : "notes"}
        </span>
      </button>
    </div>
  );
}

// ── "All Notes" / "Uncategorized" virtual covers ─────────────────────────────

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
  bar = "from-violet-500 to-purple-500",
}: VirtualCoverProps) {
  return (
    <div style={style} className="animate-float-in">
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full cursor-pointer flex-col text-left"
      >
        <Cover emoji={emoji} bar={bar} className="group-hover:-translate-y-1" />
        <h3 className="mt-2.5 line-clamp-2 text-[13.5px] font-semibold leading-snug tracking-tight text-foreground">
          {label}
        </h3>
        <span className="mt-0.5 text-[11.5px] text-muted-foreground">
          {noteCount} {noteCount === 1 ? "note" : "notes"}
        </span>
      </button>
    </div>
  );
}
