import { BookOpen, Check, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOTEBOOK_COLORS, type StoredNotebook } from "@/lib/notebooks/types";

type Props = {
  currentNotebookId: string | null | undefined;
  notebooks: StoredNotebook[];
  onMove: (notebookId: string | null) => void;
  onClose: () => void;
};

export function MoveToNotebookSheet({ currentNotebookId, notebooks, onMove, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-2xl border border-border/60 bg-[var(--surface-elevated)] p-5 pb-8 shadow-glow-lg sm:rounded-2xl animate-float-in"
      >
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <BookOpen className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight">Move to notebook</h3>
            <p className="text-[12px] text-muted-foreground">Choose where this note lives</p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-1.5">
          {/* No notebook / Uncategorized */}
          <NotebookRow
            emoji={<Inbox className="h-4 w-4" />}
            label="No notebook"
            sublabel="Appears in All Notes only"
            active={!currentNotebookId}
            onClick={() => { onMove(null); onClose(); }}
          />

          {notebooks.length === 0 && (
            <p className="py-4 text-center text-[13px] text-muted-foreground">
              No notebooks yet — create one from the notes screen.
            </p>
          )}

          {notebooks.map((nb) => {
            const c = NOTEBOOK_COLORS.find((x) => x.value === nb.color) ?? NOTEBOOK_COLORS[0];
            return (
              <NotebookRow
                key={nb.id}
                emoji={<span className="text-lg leading-none">{nb.emoji}</span>}
                label={nb.name || "Untitled notebook"}
                colorClass={c.text}
                active={currentNotebookId === nb.id}
                onClick={() => { onMove(nb.id); onClose(); }}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-border/60 bg-[var(--surface)] py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function NotebookRow({
  emoji,
  label,
  sublabel,
  colorClass,
  active,
  onClick,
}: {
  emoji: React.ReactNode;
  label: string;
  sublabel?: string;
  colorClass?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all",
        active
          ? "border-primary/40 bg-primary/10"
          : "border-border/60 bg-[var(--surface)] hover:border-border hover:bg-white/[0.04]",
      )}
    >
      <span className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
        active
          ? "bg-primary/20 text-primary ring-primary/30"
          : "bg-white/[0.06] text-muted-foreground ring-white/10",
        colorClass,
      )}>
        {emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-foreground">{label}</span>
        {sublabel && (
          <span className="block text-[11.5px] text-muted-foreground">{sublabel}</span>
        )}
      </span>
      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </button>
  );
}
