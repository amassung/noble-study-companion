import { useMemo, useState } from "react";
import { Check, RotateCcw, Sparkles, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CARD_KIND_LABEL,
  schedule,
  type Card,
  type CardProgress,
  type Grade,
} from "@/lib/cards/cards";
import { useReviewCardMutation } from "@/lib/cards/use-cards";

interface Props {
  cards: Card[];
  progressByKey: Map<string, CardProgress>;
  onClose: () => void;
}

const GRADES: { grade: Grade; label: string; hint: string; className: string }[] = [
  {
    grade: "again",
    label: "Missed",
    hint: "soon",
    className: "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20",
  },
  {
    grade: "good",
    label: "Got it",
    hint: "",
    className: "border-primary/40 bg-primary/15 text-primary hover:bg-primary/25",
  },
  {
    grade: "easy",
    label: "Easy",
    hint: "later",
    className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
  },
];

function intervalLabel(days: number): string {
  if (days <= 0) return "10m";
  if (days < 1) return "today";
  if (days === 1) return "1d";
  if (days < 30) return `${Math.round(days)}d`;
  return `${Math.round(days / 30)}mo`;
}

/**
 * Active-recall study session: show the prompt, let the student commit to an
 * answer before revealing, then grade themselves. Self-grading (rather than
 * multiple choice) is what makes this actual retrieval practice.
 */
export function FlashcardSession({ cards, progressByKey, onClose }: Props) {
  const review = useReviewCardMutation();

  // Fix the order once so grading doesn't reshuffle mid-session.
  const [queue, setQueue] = useState<Card[]>(() => {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [counts, setCounts] = useState({ again: 0, good: 0, easy: 0 });

  const card = queue[index];
  const total = queue.length;
  const done = index >= total;

  const previews = useMemo(() => {
    if (!card) return null;
    const prev = progressByKey.get(card.key);
    return {
      again: schedule(
        { ...(prev ?? emptyProgress(card)), cardKey: card.key, noteId: card.noteId },
        "again",
      ),
      good: schedule(
        { ...(prev ?? emptyProgress(card)), cardKey: card.key, noteId: card.noteId },
        "good",
      ),
      easy: schedule(
        { ...(prev ?? emptyProgress(card)), cardKey: card.key, noteId: card.noteId },
        "easy",
      ),
    };
  }, [card, progressByKey]);

  const grade = (g: Grade) => {
    if (!card) return;
    const prev = progressByKey.get(card.key);
    const next = schedule(
      { ...(prev ?? emptyProgress(card)), cardKey: card.key, noteId: card.noteId },
      g,
    );
    review.mutate(next);
    setCounts((c) => ({ ...c, [g]: c[g] + 1 }));

    // A missed card comes back at the end of this session, not in 10 minutes
    // of real time — cramming the night before a midterm should still work.
    if (g === "again") setQueue((q) => [...q, card]);

    setRevealed(false);
    setIndex((i) => i + 1);
  };

  if (done) {
    const reviewed = counts.again + counts.good + counts.easy;
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-[var(--surface)] p-6 text-center shadow-card">
        <span className="bg-gradient-violet mx-auto flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-glow">
          <Check className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-[20px] font-semibold tracking-tight">Session complete</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {reviewed} {reviewed === 1 ? "review" : "reviews"} · your schedule is updated.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-[12px]">
          <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">
            {counts.again} missed
          </span>
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-primary">
            {counts.good} got it
          </span>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
            {counts.easy} easy
          </span>
        </div>
        <button
          onClick={onClose}
          className="bg-gradient-violet hover-glow mt-5 w-full rounded-xl py-2.5 text-[13.5px] font-semibold text-white shadow-glow"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="bg-gradient-violet h-full rounded-full transition-all duration-300"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
          {index + 1} / {total}
        </span>
        <button
          onClick={onClose}
          aria-label="End session"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-[var(--surface)] text-muted-foreground hover:text-foreground"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-border/60 bg-[var(--surface)] p-6 shadow-card sm:p-8">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wider text-primary">
            {CARD_KIND_LABEL[card.kind]}
          </span>
          <span className="truncate text-[11.5px] text-muted-foreground">{card.noteTitle}</span>
        </div>

        <p className="mt-4 text-[19px] font-semibold leading-snug tracking-tight text-foreground sm:text-[22px]">
          {card.front}
        </p>

        {revealed ? (
          <div className="mt-5 border-t border-border/50 pt-5">
            <p className="text-[15px] leading-relaxed text-muted-foreground">{card.back}</p>
          </div>
        ) : (
          <p className="mt-5 text-[12.5px] text-muted-foreground/70">
            Answer it in your head first — then reveal.
          </p>
        )}
      </div>

      {/* Actions */}
      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="bg-gradient-violet hover-glow mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white shadow-glow"
        >
          <Sparkles className="h-4 w-4" />
          Show answer
        </button>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {GRADES.map((g) => (
            <button
              key={g.grade}
              onClick={() => grade(g.grade)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl border py-3 text-[13.5px] font-semibold transition-colors",
                g.className,
              )}
            >
              {g.label}
              <span className="text-[10.5px] font-normal opacity-70">
                {previews ? intervalLabel(previews[g.grade].intervalDays) : g.hint}
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-muted-foreground/70">
        <RotateCcw className="h-3 w-3" />
        Missed cards come back before the session ends
      </p>
    </div>
  );
}

function emptyProgress(card: Card): CardProgress {
  return {
    cardKey: card.key,
    noteId: card.noteId,
    ease: 2.5,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    dueAt: Date.now(),
  };
}
