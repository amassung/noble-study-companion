import { createFileRoute } from "@tanstack/react-router";
import { NotebookPen, Plus, Pencil, Check } from "lucide-react";
import { useState } from "react";
import { NoteCard, type Note } from "@/components/NoteCard";
import { NoteEditor } from "@/components/NoteEditor";
import { formatRelative } from "@/lib/notes/format";
import {
  useCreateNoteMutation,
  useDeleteNoteMutation,
  useNotes,
  useNotesList,
} from "@/lib/notes/use-notes";

export const Route = createFileRoute("/notes")({
  head: () => ({ meta: [{ title: "Nobi — My Notes" }] }),
  component: NotesPage,
});

function NotesPage() {
  const { isLoading } = useNotesList();
  const stored = useNotes();
  const createNoteMutation = useCreateNoteMutation();
  const deleteNoteMutation = useDeleteNoteMutation();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

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

  const handleNew = async () => {
    setEditMode(false);
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
            onClick={handleNew}
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
          onClick={handleNew}
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
    </div>
  );
}
