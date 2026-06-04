import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Trash2, Sparkles, Loader2 } from "lucide-react";
import { deleteNote, formatRelative, getNote, updateNote, type StoredNote } from "@/lib/notes-store";
import { StudyGuideModal } from "@/components/StudyGuideModal";

type Props = {
  noteId: string;
  onClose: () => void;
};

const SUBJECTS: { value: StoredNote["subject"]; label: string; dot: string }[] = [
  { value: "violet", label: "Philosophy", dot: "bg-primary" },
  { value: "blue", label: "Biology", dot: "bg-sky-400" },
  { value: "green", label: "Economics", dot: "bg-emerald-400" },
  { value: "amber", label: "History", dot: "bg-amber-400" },
];

export function NoteEditor({ noteId, onClose }: Props) {
  const initial = getNote(noteId);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [subject, setSubject] = useState<StoredNote["subject"]>(initial?.subject ?? "violet");
  const [subjectLabel, setSubjectLabel] = useState<string>(
    initial?.subjectLabel ?? SUBJECTS.find((s) => s.value === (initial?.subject ?? "violet"))!.label,
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("saved");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  // Autofocus title on open for blank notes
  useEffect(() => {
    if (!initial?.title) titleRef.current?.focus();
    // Lock body scroll while open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [initial?.title]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounced auto-save
  useEffect(() => {
    if (!initial) return;
    setStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNote(noteId, { title, body, subject, subjectLabel });
      setStatus("saved");
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, subject, subjectLabel]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        updateNote(noteId, { title, body, subject, subjectLabel });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!initial) return null;

  const handleDelete = () => {
    deleteNote(noteId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background animate-float-in">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{
          background: "radial-gradient(ellipse at center, oklch(0.55 0.24 295 / 0.6), transparent 60%)",
        }}
      />

      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/40 px-4 py-3 backdrop-blur-xl sm:px-6"
        style={{ backgroundColor: "color-mix(in oklab, var(--background) 80%, transparent)" }}
      >
        <button
          onClick={onClose}
          className="hover-glow flex items-center gap-1.5 rounded-lg border border-border/50 bg-[var(--surface)] px-3 py-1.5 text-[13px] font-medium text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          {status === "saving" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Saving…</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Saved · {formatRelative(initial.updatedAt)}</span>
            </>
          )}
        </div>

        <button
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete note"
          className="hover-glow flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-[var(--surface)] text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
          {/* Subject picker */}
          <div className="flex flex-wrap items-center gap-2">
            {SUBJECTS.map((s) => {
              const active = s.value === subject;
              return (
                <button
                  key={s.value}
                  onClick={() => {
                    setSubject(s.value);
                    setSubjectLabel(s.label);
                  }}
                  className={[
                    "group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-all",
                    active
                      ? "border-primary/40 bg-primary/15 text-primary shadow-glow"
                      : "border-border/60 bg-[var(--surface)] text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </button>
              );
            })}
          </div>

          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled note"
            rows={1}
            className="mt-6 w-full resize-none bg-transparent text-[32px] font-semibold leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:outline-none sm:text-[40px]"
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
          />

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Start writing your notes here…"
            className="mt-4 min-h-[55vh] w-full resize-none bg-transparent text-[16px] leading-[1.7] text-foreground/90 placeholder:text-muted-foreground/50 focus:outline-none"
          />

          {/* AI hint */}
          <div className="mt-6 flex items-center gap-2 rounded-lg border border-primary/20 bg-gradient-violet-soft px-3 py-2 text-[12.5px] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>
              <span className="text-foreground">Tip:</span> Add a few paragraphs and Nobi can generate a study guide for you.
            </span>
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-2xl border border-border/60 bg-[var(--surface-elevated)] p-5 shadow-glow-lg sm:rounded-2xl animate-float-in"
          >
            <h3 className="text-[16px] font-semibold tracking-tight">Delete this note?</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              This can't be undone. Your note will be permanently removed.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-border/60 bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-md bg-destructive px-3.5 py-2 text-[13px] font-medium text-destructive-foreground hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
