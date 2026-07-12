import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NOTEBOOK_COLORS,
  NOTEBOOK_EMOJIS,
  PAPER_TEMPLATES,
  type NotebookColor,
  type PaperTemplate,
} from "@/lib/notebooks/types";

type Props = {
  onCreate: (name: string, emoji: string, color: NotebookColor, paper: PaperTemplate) => void;
  onClose: () => void;
};

export function NewNotebookSheet({ onCreate, onClose }: Props) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📓");
  const [color, setColor] = useState<NotebookColor>("violet");
  const [paper, setPaper] = useState<PaperTemplate>("blank");
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, emoji, color, paper);
  };

  const c = NOTEBOOK_COLORS.find((x) => x.value === color) ?? NOTEBOOK_COLORS[0];

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-sm overflow-y-auto rounded-t-2xl border border-border/60 bg-[var(--surface-elevated)] p-5 pb-8 shadow-glow-lg sm:rounded-2xl animate-float-in"
      >
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-violet text-white shadow-glow">
            <BookOpen className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight">New notebook</h3>
            <p className="text-[12px] text-muted-foreground">Pick an emoji, color, and name</p>
          </div>
        </div>

        {/* Preview strip */}
        <div
          className={cn(
            "mb-4 flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ring-1 ring-inset",
            c.bg,
            c.ring,
          )}
        >
          <span className="text-2xl leading-none">{emoji}</span>
          <span className={cn("text-[14px] font-semibold", c.text)}>
            {name.trim() || "Notebook name…"}
          </span>
        </div>

        {/* Name input */}
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleConfirm();
            }
          }}
          placeholder="Notebook name…"
          maxLength={60}
          className="w-full rounded-xl border border-border/60 bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />

        {/* Emoji picker */}
        <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Emoji
        </p>
        <div className="flex flex-wrap gap-1.5">
          {NOTEBOOK_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-all",
                emoji === e
                  ? "border-primary/50 bg-primary/15 shadow-glow scale-110"
                  : "border-border/60 bg-[var(--surface)] hover:border-primary/30 hover:bg-primary/10",
              )}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Color picker */}
        <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Color
        </p>
        <div className="flex flex-wrap gap-2">
          {NOTEBOOK_COLORS.map((nc) => (
            <button
              key={nc.value}
              type="button"
              title={nc.label}
              onClick={() => setColor(nc.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-all",
                color === nc.value
                  ? `${nc.bg} ${nc.text} border-transparent ring-1 ring-inset ${nc.ring} shadow-sm`
                  : "border-border/60 bg-[var(--surface)] text-muted-foreground hover:text-foreground",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full bg-gradient-to-br", nc.bar)} />
              {nc.label}
            </button>
          ))}
        </div>

        {/* Paper template picker */}
        <p className="mb-2 mt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Paper
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {PAPER_TEMPLATES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPaper(p.value)}
              className={cn(
                "flex shrink-0 flex-col items-center gap-1.5",
                paper === p.value ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-16 w-12 rounded-md border bg-[var(--paper)] transition-all",
                  p.className,
                  paper === p.value
                    ? "border-primary ring-2 ring-inset ring-primary/40"
                    : "border-border/60 hover:border-primary/40",
                )}
              />
              <span className="text-[10.5px] font-medium">{p.label}</span>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!name.trim()}
            className="hover-glow flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-violet py-2.5 text-[13.5px] font-semibold text-white shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <BookOpen className="h-4 w-4" />
            Create notebook
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/60 bg-[var(--surface)] px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
