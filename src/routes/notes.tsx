import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, NotebookPen, Plus, Pencil, Check, BookOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { NoteCard, type Note } from "@/components/NoteCard";
import { NoteEditor } from "@/components/NoteEditor";
import { NotebookCover, VirtualNotebookCover } from "@/components/NotebookCover";
import { NewNotebookSheet } from "@/components/NewNotebookSheet";
import { AnnotationProvider } from "@/components/AnnotationContext";
import { formatRelative } from "@/lib/notes/format";
import {
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useNotes,
  useNotesList,
} from "@/lib/notes/use-notes";
import {
  useNotebooks,
  useNotebooksList,
  useCreateNotebookMutation,
  useDeleteNotebookMutation,
} from "@/lib/notebooks/use-notebooks";
import { NOTE_SUBJECTS } from "@/lib/notes/types";
import type { Subject } from "@/components/NoteCard";
import type { NotebookColor, PaperTemplate } from "@/lib/notebooks/types";
import { NOTEBOOK_COLORS, NOTEBOOK_EMOJIS } from "@/lib/notebooks/types";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { fetchInkForNotes } from "@/lib/ink/ink-api";

export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "Nobi — My Notes" }] }),
  component: NotesPage,
});

// ── Subject pill config ────────────────────────────────────────────────────
const SUBJECT_OPTIONS: {
  value: Subject;
  label: string;
  dot: string;
  ring: string;
  bg: string;
  text: string;
}[] = [
  {
    value: "violet",
    label: "Philosophy",
    dot: "bg-primary",
    ring: "ring-primary/30",
    bg: "bg-primary/15",
    text: "text-primary",
  },
  {
    value: "blue",
    label: "Biology",
    dot: "bg-sky-400",
    ring: "ring-sky-400/30",
    bg: "bg-sky-500/15",
    text: "text-sky-300",
  },
  {
    value: "green",
    label: "Economics",
    dot: "bg-emerald-400",
    ring: "ring-emerald-400/30",
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
  },
  {
    value: "amber",
    label: "History",
    dot: "bg-amber-400",
    ring: "ring-amber-400/30",
    bg: "bg-amber-500/15",
    text: "text-amber-300",
  },
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

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleConfirm = () => {
    const s = SUBJECT_OPTIONS.find((o) => o.value === subject)!;
    onCreate(title.trim(), subject, s.label);
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
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-violet text-white shadow-glow">
            <Plus className="h-4.5 w-4.5" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight">New note</h3>
            <p className="text-[12px] text-muted-foreground">Give it a name and pick a subject</p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleConfirm();
            }
          }}
          placeholder="Note name…"
          maxLength={200}
          className="w-full rounded-xl border border-border/60 bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />

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
                    ? `border-transparent ${s.bg} ${s.text} shadow-sm ring-1 ring-inset ${s.ring}`
                    : "border-border/60 bg-[var(--surface)] text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                {s.label}
              </button>
            );
          })}
        </div>

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
  const { isLoading: notesLoading } = useNotesList();
  const { isLoading: notebooksLoading } = useNotebooksList();
  const allStoredNotes = useNotes();
  const notebooks = useNotebooks();
  const createNoteMutation = useCreateNoteMutation();
  const deleteNoteMutation = useDeleteNoteMutation();
  const createNotebookMutation = useCreateNotebookMutation();
  const deleteNotebookMutation = useDeleteNotebookMutation();

  // Which notebook is open: null = shelf, "all" = all notes, "uncategorized" = orphans, or a uuid
  const [selectedNotebookId, setSelectedNotebookId] = useState<
    string | null | "all" | "uncategorized"
  >(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showNewNote, setShowNewNote] = useState(false);
  const [showNewNotebook, setShowNewNotebook] = useState(false);

  // Leave edit mode when navigating
  useEffect(() => {
    setEditMode(false);
  }, [selectedNotebookId]);

  const isLoading = notesLoading || notebooksLoading;

  // Compute note counts per notebook
  const notesForNotebook = (nbId: string) => allStoredNotes.filter((n) => n.notebookId === nbId);
  const uncategorizedNotes = allStoredNotes.filter((n) => !n.notebookId);

  // Notes to show in the current view
  const visibleNotes = (() => {
    if (selectedNotebookId === "all") return allStoredNotes;
    if (selectedNotebookId === "uncategorized") return uncategorizedNotes;
    if (selectedNotebookId) return notesForNotebook(selectedNotebookId);
    return [];
  })();

  const currentNotebook = notebooks.find((nb) => nb.id === selectedNotebookId);

  // Handwriting for every note on screen, in one request rather than one per
  // card. Thumbnails are decorative, so a failure here must never take the
  // list down with it — the cards simply render their typed content.
  const visibleIds = visibleNotes.map((n) => n.id);
  const { data: inkByNote = {} } = useQuery({
    queryKey: ["ink-thumbnails", visibleIds],
    queryFn: () => fetchInkForNotes(visibleIds),
    enabled: visibleIds.length > 0,
    staleTime: 60_000,
  });

  // Default subject cycles through note count
  const defaultSubjectIndex = allStoredNotes.length % NOTE_SUBJECTS.length;

  // ── New note ──────────────────────────────────────────────────────────
  const openNewNote = () => {
    setEditMode(false);
    setShowNewNote(true);
  };

  const handleCreateNote = async (title: string, subject: Subject, subjectLabel: string) => {
    const notebookId =
      selectedNotebookId && selectedNotebookId !== "all" && selectedNotebookId !== "uncategorized"
        ? selectedNotebookId
        : null;
    try {
      const note = await createNoteMutation.mutateAsync({
        title,
        subject,
        subjectLabel,
        notebookId,
      });
      setShowNewNote(false);
      setOpenNoteId(note.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create note. Try again.");
    }
  };

  const handleSkipNote = async () => {
    const notebookId =
      selectedNotebookId && selectedNotebookId !== "all" && selectedNotebookId !== "uncategorized"
        ? selectedNotebookId
        : null;
    try {
      const note = await createNoteMutation.mutateAsync({ notebookId });
      setShowNewNote(false);
      setOpenNoteId(note.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create note. Try again.");
    }
  };

  // ── New notebook ──────────────────────────────────────────────────────
  const handleCreateNotebook = async (
    name: string,
    emoji: string,
    color: NotebookColor,
    paper: PaperTemplate,
  ) => {
    try {
      const nb = await createNotebookMutation.mutateAsync({ name, emoji, color, paper });
      setShowNewNotebook(false);
      setSelectedNotebookId(nb.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create notebook. Try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  // ── Notes grid (used both in notebook view and virtual views) ─────────
  const notes: Note[] = visibleNotes.map((n) => ({
    id: n.id,
    subject: n.subject,
    subjectLabel: n.subjectLabel,
    title: n.title,
    preview: n.body,
    date: formatRelative(n.updatedAt),
    guideReady: n.body.length > 240,
    testDate: n.testDate ?? null,
    body: n.body,
    ink: inkByNote[n.id],
    paper: n.paper ?? notebooks.find((nb) => nb.id === n.notebookId)?.paper,
  }));

  // ── Notebook view (inside a specific notebook / virtual) ──────────────
  if (selectedNotebookId !== null) {
    const heading =
      selectedNotebookId === "all"
        ? "All Notes"
        : selectedNotebookId === "uncategorized"
          ? "Uncategorized"
          : currentNotebook
            ? `${currentNotebook.emoji} ${currentNotebook.name}`
            : "Notebook";

    return (
      <AnnotationProvider>
        <div className="animate-float-in">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedNotebookId(null)}
                className="hover-glow flex items-center gap-1.5 rounded-lg border border-border/50 bg-[var(--surface)] px-3 py-1.5 text-[13px] font-medium text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Notebooks</span>
              </button>
              <div>
                <h1 className="text-[24px] font-semibold tracking-tight">{heading}</h1>
                <p className="text-[12.5px] text-muted-foreground">
                  {notes.length} {notes.length === 1 ? "note" : "notes"} · auto-saved
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
                onClick={openNewNote}
                disabled={editMode}
                className="hover-glow flex items-center gap-1.5 rounded-lg bg-gradient-violet px-3.5 py-2 text-[13px] font-medium text-white shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
                New note
              </button>
            </div>
          </div>

          {/* Empty state */}
          {notes.length === 0 ? (
            <button
              onClick={openNewNote}
              className="hover-glow mt-8 flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-[var(--surface)]/40 py-16 text-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-violet text-white shadow-glow">
                <Plus className="h-5 w-5" />
              </span>
              <span className="mt-3 text-[14px] font-medium">Add your first note here</span>
              <span className="mt-1 text-[12.5px] text-muted-foreground">
                Auto-saved as you type.
              </span>
            </button>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {notes.map((n, i) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  style={{ animationDelay: `${60 + i * 40}ms` }}
                  onOpen={editMode ? undefined : setOpenNoteId}
                  onDelete={(id) => deleteNoteMutation.mutate(id)}
                  editMode={editMode}
                />
              ))}
            </div>
          )}

          {/* Note editor */}
          {openNoteId && (
            <NoteEditor
              noteId={openNoteId}
              onClose={() => {
                setOpenNoteId(null);
                setEditMode(false);
              }}
            />
          )}

          {/* New note sheet */}
          {showNewNote && (
            <NewNoteSheet
              defaultSubjectIndex={defaultSubjectIndex}
              onCreate={handleCreateNote}
              onSkip={handleSkipNote}
              onClose={() => setShowNewNote(false)}
            />
          )}
        </div>
      </AnnotationProvider>
    );
  }

  // ── Shelf view (top-level notebooks grid) ─────────────────────────────
  const hasUncategorized = uncategorizedNotes.length > 0;

  return (
    <AnnotationProvider>
      <div className="animate-float-in">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-violet-soft text-primary ring-1 ring-primary/30">
              <NotebookPen className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight">My Notes</h1>
              <p className="text-[12.5px] text-muted-foreground">
                {notebooks.length} {notebooks.length === 1 ? "notebook" : "notebooks"} ·{" "}
                {allStoredNotes.length} {allStoredNotes.length === 1 ? "note" : "notes"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {notebooks.length > 0 && (
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
              onClick={() => {
                setEditMode(false);
                setShowNewNotebook(true);
              }}
              disabled={editMode}
              className="hover-glow flex items-center gap-1.5 rounded-lg bg-gradient-violet px-3.5 py-2 text-[13px] font-medium text-white shadow-glow disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              New notebook
            </button>
          </div>
        </div>

        {/* Empty state — no notebooks yet */}
        {notebooks.length === 0 && !hasUncategorized ? (
          <button
            onClick={() => setShowNewNotebook(true)}
            className="hover-glow mt-8 flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-[var(--surface)]/40 py-16 text-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-violet text-white shadow-glow">
              <BookOpen className="h-5 w-5" />
            </span>
            <span className="mt-3 text-[14px] font-medium">Create your first notebook</span>
            <span className="mt-1 text-[12.5px] text-muted-foreground">
              Organise notes by class or subject.
            </span>
          </button>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {/* All Notes virtual cover — always first */}
            <VirtualNotebookCover
              label="All Notes"
              emoji="📚"
              noteCount={allStoredNotes.length}
              style={{ animationDelay: "60ms" }}
              onOpen={() => setSelectedNotebookId("all")}
            />

            {/* User notebooks */}
            {notebooks.map((nb, i) => (
              <NotebookCover
                key={nb.id}
                notebook={nb}
                noteCount={notesForNotebook(nb.id).length}
                style={{ animationDelay: `${100 + i * 40}ms` }}
                onOpen={(id) => setSelectedNotebookId(id)}
                onDelete={(id) => deleteNotebookMutation.mutate(id)}
                editMode={editMode}
              />
            ))}

            {/* Uncategorized virtual cover — only if orphan notes exist */}
            {hasUncategorized && (
              <VirtualNotebookCover
                label="Uncategorized"
                emoji="📁"
                noteCount={uncategorizedNotes.length}
                style={{ animationDelay: `${100 + notebooks.length * 40}ms` }}
                onOpen={() => setSelectedNotebookId("uncategorized")}
                bar="from-muted-foreground/40 to-muted-foreground/20"
              />
            )}
          </div>
        )}

        {/* New notebook sheet */}
        {showNewNotebook && (
          <NewNotebookSheet
            onCreate={handleCreateNotebook}
            onClose={() => setShowNewNotebook(false)}
          />
        )}
      </div>
    </AnnotationProvider>
  );
}
