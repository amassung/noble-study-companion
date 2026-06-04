import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Trash2, Sparkles, Loader2, CalendarClock, X as XIcon } from "lucide-react";
import { toast } from "sonner";
import { formatRelative, formatTestCountdown } from "@/lib/notes/format";
import {
  useDeleteNoteMutation,
  useNotes,
  useNotesList,
  useDeleteGuideMutation,
  useSetTestDateMutation,
  useUpdateNoteMutation,
  type SavedGuide,
  type StoredNote,
} from "@/lib/notes/use-notes";
import { StudyGuideModal } from "@/components/StudyGuideModal";
import type { StudyGuide } from "@/lib/study-guide.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

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
  const { isLoading } = useNotesList();
  const allNotes = useNotes();
  const liveNote = allNotes.find((n) => n.id === noteId);
  const updateMutation = useUpdateNoteMutation();
  const deleteMutation = useDeleteNoteMutation();
  const setTestDateMutation = useSetTestDateMutation();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState<StoredNote["subject"]>("violet");
  const [subjectLabel, setSubjectLabel] = useState("Philosophy");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("saved");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [viewGuide, setViewGuide] = useState<StudyGuide | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const savedGuides: SavedGuide[] = liveNote?.guides ?? [];
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setHydrated(false);
  }, [noteId]);

  useEffect(() => {
    if (!liveNote || hydrated) return;
    setTitle(liveNote.title);
    setBody(liveNote.body);
    setSubject(liveNote.subject);
    setSubjectLabel(
      liveNote.subjectLabel ?? SUBJECTS.find((s) => s.value === liveNote.subject)!.label,
    );
    setHydrated(true);
  }, [liveNote, hydrated]);

  useEffect(() => {
    if (!hydrated || !liveNote?.title) return;
    titleRef.current?.focus();
  }, [hydrated, liveNote?.title]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!hydrated) return;
    setStatus("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateMutation.mutate(
        { id: noteId, patch: { title, body, subject, subjectLabel } },
        { onSettled: () => setStatus("saved") },
      );
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title, body, subject, subjectLabel, noteId, hydrated, updateMutation]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (hydrated) {
        updateMutation.mutate({ id: noteId, patch: { title, body, subject, subjectLabel } });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading || !hydrated) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!liveNote) {
    return null;
  }

  const handleDelete = () => {
    deleteMutation.mutate(noteId, { onSuccess: onClose });
  };

  const lastSavedAt = liveNote.updatedAt;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background animate-float-in">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{
          background: "radial-gradient(ellipse at center, oklch(0.55 0.24 295 / 0.6), transparent 60%)",
        }}
      />

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
              <span>Saved · {formatRelative(lastSavedAt)}</span>
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

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
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

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "hover-glow flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                    liveNote.testDate
                      ? "border-primary/40 bg-primary/15 text-primary shadow-glow"
                      : "border-border/60 bg-[var(--surface)] text-muted-foreground hover:text-foreground",
                  )}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  {liveNote.testDate
                    ? formatTestCountdown(liveNote.testDate, subjectLabel)
                    : "Set test date"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={liveNote.testDate ? new Date(liveNote.testDate) : undefined}
                  onSelect={(d) =>
                    setTestDateMutation.mutate({ id: noteId, date: d ?? null })
                  }
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {liveNote.testDate ? (
              <>
                <span className="text-[11.5px] text-muted-foreground">
                  {new Date(liveNote.testDate).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <button
                  onClick={() => setTestDateMutation.mutate({ id: noteId, date: null })}
                  aria-label="Clear test date"
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-[var(--surface)] text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </>
            ) : null}
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

          <button
            onClick={() => setGuideOpen(true)}
            disabled={body.trim().length < 20}
            className="group mt-8 flex w-full items-center gap-4 overflow-hidden rounded-xl border border-primary/30 bg-gradient-violet p-4 text-left shadow-glow transition-transform duration-200 hover:scale-[1.005] active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            aria-label="Generate study guide"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25 backdrop-blur">
              <Sparkles className="h-5 w-5 text-white" strokeWidth={2.3} />
            </span>
            <span className="flex-1">
              <span className="block text-[14.5px] font-semibold text-white">Generate Study Guide</span>
              <span className="mt-0.5 block text-[12.5px] text-white/80">
                {body.trim().length < 20
                  ? "Write a few sentences first…"
                  : "Key concepts, terms, and practice questions — in seconds."}
              </span>
            </span>
          </button>

          <section className="mt-10">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <h3 className="text-[14px] font-semibold tracking-tight">Saved Study Guides</h3>
                {savedGuides.length > 0 && (
                  <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                    {savedGuides.length}
                  </span>
                )}
              </div>
            </div>
            {savedGuides.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 bg-[var(--surface)]/40 px-4 py-6 text-center text-[13px] text-muted-foreground">
                No saved guides yet. Generate one above to save it here.
              </p>
            ) : (
              <div className="space-y-2.5">
                {savedGuides.map((sg) => (
                  <SavedGuideRow
                    key={sg.id}
                    noteId={noteId}
                    saved={sg}
                    onOpen={() => setViewGuide(sg.guide)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {guideOpen && (
        <StudyGuideModal
          open={guideOpen}
          onClose={() => setGuideOpen(false)}
          note={{ title, body, subjectLabel }}
          noteId={noteId}
        />
      )}

      {viewGuide && (
        <StudyGuideModal
          open={!!viewGuide}
          onClose={() => setViewGuide(null)}
          note={{ title, body, subjectLabel }}
          initialGuide={viewGuide}
        />
      )}

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
              This can&apos;t be undone. Your note will be permanently removed.
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

function SavedGuideRow({
  noteId,
  saved,
  onOpen,
}: {
  noteId: string;
  saved: SavedGuide;
  onOpen: () => void;
}) {
  const deleteGuideMutation = useDeleteGuideMutation();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { guide, createdAt, id: guideId } = saved;
  const date = new Date(createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = new Date(createdAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const handleDelete = () => {
    deleteGuideMutation.mutate(
      { noteId, guideId },
      {
        onSuccess: () => {
          toast.success("Study guide deleted");
          setConfirmDelete(false);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Couldn't delete study guide");
        },
      },
    );
  };

  return (
    <>
      <div className="group flex items-center gap-2 overflow-hidden rounded-xl border border-border/60 bg-[var(--surface)] transition-colors hover:border-primary/30">
        <button
          type="button"
          onClick={onOpen}
          className="hover-glow flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-violet text-white shadow-glow">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.3} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium text-foreground">
              {guide.title || "Study Guide"}
            </span>
            <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
              Created {date} · {time}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete study guide"
          className="hover-glow mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-[var(--surface)] text-muted-foreground opacity-80 transition-colors hover:text-destructive group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setConfirmDelete(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-2xl border border-border/60 bg-[var(--surface-elevated)] p-5 shadow-glow-lg sm:rounded-2xl animate-float-in"
          >
            <h3 className="text-[16px] font-semibold tracking-tight">Delete this study guide?</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              &ldquo;{guide.title || "Study Guide"}&rdquo; will be permanently removed.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-md border border-border/60 bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteGuideMutation.isPending}
                className="rounded-md bg-destructive px-3.5 py-2 text-[13px] font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-60"
              >
                {deleteGuideMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
