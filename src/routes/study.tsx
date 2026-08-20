import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, ChevronRight, HelpCircle, Layers, NotebookPen, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { FlashcardSession } from "@/components/FlashcardSession";
import { allCards, dueCards } from "@/lib/cards/cards";
import { useCardProgress } from "@/lib/cards/use-cards";
import { StudyGuideModal } from "@/components/StudyGuideModal";
import type { Subject } from "@/components/NoteCard";
import { formatRelative } from "@/lib/notes/format";
import { useNotes, useNotesList } from "@/lib/notes/use-notes";
import type { StudyGuide } from "@/lib/study-guide.functions";

export const Route = createFileRoute("/study")({
  head: () => ({ meta: [{ title: "Nobi — Study Mode" }] }),
  component: StudyPage,
});

// Mirror the exact tokens from NoteCard so subject pills look consistent.
const subjectStyles: Record<Subject, { bg: string; text: string; ring: string; label: string }> = {
  violet: {
    bg: "bg-primary/15",
    text: "text-primary",
    ring: "ring-primary/30",
    label: "Philosophy",
  },
  blue: {
    bg: "bg-sky-500/15",
    text: "text-sky-300",
    ring: "ring-sky-400/30",
    label: "Biology",
  },
  green: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    ring: "ring-emerald-400/30",
    label: "Economics",
  },
  amber: {
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    ring: "ring-amber-400/30",
    label: "History",
  },
};

type SelectedGuide = {
  guide: StudyGuide;
  note: { title: string; body: string; subjectLabel?: string };
  noteId: string;
};

function StudyPage() {
  const { isLoading } = useNotesList();
  const notes = useNotes();
  const [selected, setSelected] = useState<SelectedGuide | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [sessionCards, setSessionCards] = useState<ReturnType<typeof allCards> | null>(null);

  // Flashcards are derived from saved guides, so they need no extra storage
  // and appear the moment a guide is generated.
  const { byKey: progressByKey } = useCardProgress();
  const cards = useMemo(() => allCards(notes), [notes]);
  const due = useMemo(() => dueCards(cards, progressByKey), [cards, progressByKey]);

  // Build the guide list: one entry per note (most recent guide only),
  // only notes that have at least one saved guide.
  const guideGroups = notes
    .filter((n) => n.guides && n.guides.length > 0)
    .map((n) => {
      // guides are already sorted newest-first by notes-api
      const latestGuide = n.guides![0];
      return { note: n, savedGuide: latestGuide };
    });

  const totalGuides = guideGroups.length;

  const handleOpen = (entry: (typeof guideGroups)[number]) => {
    setSelected({
      guide: entry.savedGuide.guide,
      note: {
        title: entry.note.title,
        body: entry.note.body,
        subjectLabel: entry.note.subjectLabel,
      },
      noteId: entry.note.id,
    });
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Loading your study guides…
      </div>
    );
  }

  // A running session takes over the page so nothing competes with recall.
  if (sessionCards) {
    return (
      <div className="animate-float-in">
        <FlashcardSession
          cards={sessionCards}
          progressByKey={progressByKey}
          onClose={() => setSessionCards(null)}
        />
      </div>
    );
  }

  return (
    <div className="animate-float-in">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-violet-soft text-primary ring-1 ring-primary/30">
          <Brain className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Study Mode</h1>
          <p className="text-[12.5px] text-muted-foreground">
            {totalGuides === 0
              ? "No study guides yet"
              : `${totalGuides} ${totalGuides === 1 ? "guide" : "guides"} saved`}
          </p>
        </div>
      </div>

      {/* Flashcards — the active-recall entry point */}
      {cards.length > 0 && (
        <button
          onClick={() => setSessionCards(due.length > 0 ? due : cards)}
          className="group bg-gradient-violet shadow-glow mt-6 flex w-full items-center gap-4 overflow-hidden rounded-xl border border-primary/30 p-4 text-left transition-transform duration-200 hover:scale-[1.005] active:scale-[0.995]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <Layers className="h-5 w-5 text-white" strokeWidth={2.3} />
          </span>
          <span className="flex-1">
            <span className="block text-[14.5px] font-semibold text-white">
              {due.length > 0
                ? `Review ${due.length} card${due.length === 1 ? "" : "s"}`
                : "Practice all cards"}
            </span>
            <span className="mt-0.5 block text-[12.5px] text-white/80">
              {due.length > 0
                ? "Due now — spaced repetition from your study guides."
                : `All caught up. ${cards.length} card${cards.length === 1 ? "" : "s"} available to practise anyway.`}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/90 transition-transform group-hover:translate-x-0.5" />
        </button>
      )}

      {/* Empty state */}
      {guideGroups.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-[var(--surface)]/40 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-violet text-white shadow-glow">
            <Brain className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-[15px] font-semibold">No study guides yet</h2>
          <p className="mt-1.5 max-w-xs text-[13px] text-muted-foreground">
            Open a note and tap{" "}
            <span className="inline-flex items-center gap-0.5 text-primary">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
              Generate
            </span>{" "}
            to create your first study guide.
          </p>
          <Link
            to="/notes"
            className="hover-glow mt-6 flex items-center gap-1.5 rounded-lg border border-border/60 bg-[var(--surface)] px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <NotebookPen className="h-4 w-4" />
            Go to My Notes
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {guideGroups.map(({ note, savedGuide }, i) => {
            const s = subjectStyles[note.subject];
            const qCount = savedGuide.guide.practiceQuestions?.length ?? 0;
            const noteTitle = note.title || "Untitled note";
            const subjectLabel = note.subjectLabel || s.label;
            const createdLabel = formatRelative(savedGuide.createdAt);

            return (
              <div
                key={note.id}
                className="animate-float-in"
                style={{ animationDelay: `${60 + i * 50}ms` }}
              >
                {/* Note group header */}
                <div className="mb-2.5 flex items-center gap-2.5 px-1">
                  <span
                    className={[
                      "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                      s.bg,
                      s.text,
                      s.ring,
                    ].join(" ")}
                  >
                    {subjectLabel}
                  </span>
                  <span className="min-w-0 truncate text-[13.5px] font-semibold text-foreground">
                    {noteTitle}
                  </span>
                </div>

                {/* Guide card */}
                <button
                  onClick={() => handleOpen({ note, savedGuide })}
                  className="hover-glow group flex w-full items-center gap-4 rounded-xl border border-border/60 bg-[var(--surface)] p-4 text-left shadow-card transition-all"
                >
                  {/* Icon */}
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-violet-soft text-primary ring-1 ring-primary/25">
                    <Sparkles className="h-4.5 w-4.5" strokeWidth={2.2} />
                  </span>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-foreground">
                      {savedGuide.guide.title || noteTitle}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      {qCount > 0 && (
                        <span className="flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary ring-1 ring-inset ring-primary/20">
                          <HelpCircle className="h-3 w-3" />
                          {qCount} {qCount === 1 ? "question" : "questions"}
                        </span>
                      )}
                      <span className="text-[11.5px] text-muted-foreground">{createdLabel}</span>
                    </div>
                  </div>

                  {/* Chevron */}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal — renders instantly from stored guide, no AI call */}
      <StudyGuideModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        note={selected?.note ?? { title: "", body: "" }}
        noteId={selected?.noteId}
        initialGuide={selected?.guide}
      />
    </div>
  );
}
