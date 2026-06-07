import { createFileRoute } from "@tanstack/react-router";
import { NotebookPen, Plus, Pencil, Check } from "lucide-react";
import { AnnotationProvider } from "@/components/AnnotationContext";
import { useEffect, useRef, useState } from "react";
import { NoteCard, type Note } from "@/components/NoteCard";
import { NoteEditor } from "@/components/NoteEditor";
import { formatRelative } from "@/lib/notes/format";
import {
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useNotes,
  useNotesList,
} from "@/lib/notes/use-notes";
import { NOTE_SUBJECTS } from "@/lib/notes/types";
import type { Subject } from "@/components/NoteCard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "Nobi — My Notes" }] }),
  component: NotesPage,
});

// ── Subject pill config (mirrors NoteEditor) ───────────────────────────────
const SUBJECT_OPTIONS: { value: Subject; label: string; dot: string; ring: string; bg: string; text: string }[] = [
  { value: "violet", label: "Philosophy", dot: "bg-primary",      ring: "ring-primary/30",      bg: "bg-primary/15",      text: "text-primary" },
  { value: "blue",   label: "Biology",    dot: "bg-sky-400",      ring: "ring-sky-400/30",      bg: "bg-sky-500/15",      text: "text-sky-300" },
  { value: "green",  label: "Economics",  dot: "bg-emerald-400",  ring: "ring-emerald-400/30",  bg: "bg-emerald-500/15",  text: "text-emerald-300" },
  { value: "amber",  label: "History",    dot: "bg-amber-400",    ring: "ring-amber-400/30",    bg: "bg-amber-500/15",    text: "text-amber-300" },
];

// ── NewNoteSheet ───────────────────────────────────────────────────────────
function NewNoteSheet({
  defaultSubjectIndex,
  onCreate,
  onSkip,
  onClose,
}: {
  defaultSubjectIndex: number;
  onCreate: (title: string, subject: Subject, subjectLabel: string) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<Subject>(
    NOTE_SUBJECTS[defaultSubjectIndex % NOTE_SUBJECTS.length],
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus the input when the sheet opens
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Escape closes without creating
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleConfirm = () => {
    const s = SUBJECT_OPTIONS.find((o) => o.value === subject)!;
    onCreate(title.trim(), subject, s.label);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
  };

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
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-violet text-white shadow-glow">
            <Plus className="h-4.5 w-4.5" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight">New note</h3>
            <p className="text-[12px] text-muted-foreground">Give it a name and pick a subject</p>
          </div>
        </div>

        {/* Name input */}
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Note name…"
          maxLength={200}
          className="w-full rounded-xl border border-border/60 bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />

        {/* Subject pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          {SUBJECT_OPTIONS.map((s) => {
            const active = s.value === subject;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setSubject(s.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-all",
                  active
                    ? `border-[color:var(--active-ring)] ${s.bg} ${s.text} shadow-sm ring-1 ring-inset`
                    : "border-border/60 bg-[var(--surface)] text-muted-foreground hover:text-foreground",
                )}
                style={active ? { "--active-ring": "var(--ring-color)" } as React.CSSProperties : {}}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            className="hover-glow flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-violet py-2.5 text-[13.5px] font-semibold text-white shadow-glow"
          >
            <Plus className="h-4 w-4" />
            Create note
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-xl border border-border/60 bg-[var(--surface)] px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NotesPage ──────────────────────────────────────────────────────────────
function NotesPage() {
  const { isLoading } = useNotesList();
  const stored = useNotes();
  const createNoteMutation = useCreateNoteMutation();
  const deleteNoteMutation = useDeleteNoteMutation();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  const notes: Note[] = stored.map((n) => ({
    id: n.id,
    subject: n.subject,
    subjectLabel: n.subjectLabel,
    title: n.title,
    preview: n.body,
    date: formatRelative(n.updatedAt),
    guideReady: n.body.length > 240,
    testDate: n.testDate ?? null,
  }));

  // Default subject for the modal: next in cycle based on current note count
  const defaultSubjectIndex = stored.length % NOTE_SUBJECTS.length;

  const openModal = () => {
    setEditMode(false);
    setShowNewModal(true);
  };

  const handleCreate = async (title: string, subject: Subject, subjectLabel: string) => {
    setShowNewModal(false);
    const note = await createNoteMutation.mutateAsync({ title, subject, subjectLabel });
    setOpenId(note.id);
  };

  const handleSkip = async () => {
    setShowNewModal(false);
    const note = await createNoteMutation.mutateAsync();
    setOpenId(note.id);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading your notes…
      </div>
    );
  }

  return (
    <AnnotationProvider>
    <div className="animate-float-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-violet-soft text-primary ring-1 ring-primary/30">
            <NotebookPen className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">My Notes</h1>
            <p className="text-[12.5px] text-muted-foreground">
              {stored.length} {stored.length === 1 ? "note" : "notes"} · auto-saved
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {notes.length > 0 && (
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`hover-glow flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                editMode
                  ? "border-primary/40 bg-primary/15 text-primary shadow-glow"
                  : "border-border/50 bg-[var(--surface)] text-muted-foreground hover:text-foreground"
              }`}
            >
              {editMode ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Done
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </>
              )}
            </button>
          )}
          <button
            onClick={openModal}
            disabled={editMode}
            className="hover-glow flex items-center gap-1.5 rounded-lg bg-gradient-violet px-3.5 py-2 text-[13px] font-medium text-white shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            New note
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <button
          onClick={openModal}
          className="hover-glow mt-8 flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-[var(--surface)]/40 py-16 text-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-violet text-white shadow-glow">
            <Plus className="h-5 w-5" />
          </span>
          <span className="mt-3 text-[14px] font-medium">Create your first note</span>
          <span className="mt-1 text-[12.5px] text-muted-foreground">Auto-saved as you type.</span>
        </button>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((n, i) => (
            <NoteCard
              key={n.id}
              note={n}
              style={{ animationDelay: `${60 + i * 40}ms` }}
              onOpen={editMode ? undefined : setOpenId}
              onDelete={(id) => deleteNoteMutation.mutate(id)}
              editMode={editMode}
            />
          ))}
        </div>
      )}

      {openId && (
        <NoteEditor
          noteId={openId}
          onClose={() => {
            setOpenId(null);
            setEditMode(false);
          }}
        />
      )}

      {showNewModal && (
        <NewNoteSheet
          defaultSubjectIndex={defaultSubjectIndex}
          onCreate={handleCreate}
          onSkip={handleSkip}
          onClose={() => setShowNewModal(false)}
        />
      )}
    </div>
    </AnnotationProvider>
  );
}
