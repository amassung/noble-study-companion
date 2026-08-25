import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Layers,
  ListChecks,
  Loader2,
  Send,
  Sparkles,
  SquareCheck,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cardsForNote, type Card, type CardKind } from "@/lib/cards/cards";
import { askNote } from "@/lib/notes/ask-note.functions";
import type { StoredNote } from "@/lib/notes/types";
import { cn } from "@/lib/utils";

/** The three ways in, and which cards each one draws on. */
type Drill = "flashcards" | "questions" | "mixed";

const DRILL_KINDS: Record<Drill, CardKind[]> = {
  // Recognition material: a term or a concept on the front, meaning on the back.
  flashcards: ["term", "concept"],
  // Recall material: the guide's practice questions.
  questions: ["question"],
  mixed: ["term", "concept", "question"],
};

const DRILL_LABEL: Record<Drill, string> = {
  flashcards: "Memorize with flashcards",
  questions: "Practice with questions",
  mixed: "Mixed-method test",
};

/** Deterministic shuffle so a drill doesn't reorder itself on every render. */
function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function stripHtml(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, " ");
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent ?? "";
}

/**
 * The study surface for a single note: what the note boils down to, three ways
 * to drill it, and a grounded Q&A over the note's own text.
 *
 * Everything here is derived from study guides the student has already saved —
 * the AI work happens once, at generation, and this is the place it gets used
 * rather than another button that calls the model again.
 */
export function LearnSheet({
  open,
  onClose,
  note,
  title,
  body,
  onGenerate,
}: {
  open: boolean;
  onClose: () => void;
  note: StoredNote | undefined;
  title: string;
  body: string;
  onGenerate: () => void;
}) {
  const [drill, setDrill] = useState<Drill | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const seedRef = useRef(Date.now() % 100000);

  const cards = useMemo(() => (note ? cardsForNote(note) : []), [note]);
  const countFor = (d: Drill) => cards.filter((c) => DRILL_KINDS[d].includes(c.kind)).length;

  const deck: Card[] = useMemo(() => {
    if (!drill) return [];
    const picked = cards.filter((c) => DRILL_KINDS[drill].includes(c.kind));
    return drill === "mixed" ? shuffled(picked, seedRef.current) : picked;
  }, [drill, cards]);

  const latestGuide = note?.guides?.[note.guides.length - 1]?.guide;
  const summary = latestGuide?.keyConcepts ?? [];

  const ask = useServerFn(askNote);
  const askMutation = useMutation({
    mutationFn: (q: string) => ask({ data: { question: q, title, body: stripHtml(body) } }),
    onSuccess: (r) => setAnswer(r.answer),
    onError: (e: Error) => toast.error(e.message || "Couldn't answer that."),
  });

  const startDrill = (d: Drill) => {
    seedRef.current = Date.now() % 100000;
    setDrill(d);
    setIndex(0);
    setRevealed(false);
  };

  const closeSheet = () => {
    setDrill(null);
    setAnswer(null);
    setQuestion("");
    onClose();
  };

  const current = deck[index];
  const atEnd = drill !== null && index >= deck.length;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && closeSheet()}>
      <SheetContent
        side="bottom"
        className="h-[88svh] rounded-t-2xl border-border/60 bg-[var(--surface)] p-0"
      >
        <SheetHeader className="border-b border-border/50 px-5 py-4">
          <SheetTitle className="flex items-center justify-center gap-2 text-[15px]">
            {drill && (
              <button
                type="button"
                onClick={() => setDrill(null)}
                aria-label="Back to Learn"
                className="absolute left-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {drill ? DRILL_LABEL[drill] : "Learn"}
          </SheetTitle>
        </SheetHeader>

        <div className="h-[calc(88svh-61px)] overflow-y-auto px-5 py-5">
          {drill ? (
            /* ── Drill ─────────────────────────────────────────────── */
            <div className="mx-auto flex h-full max-w-xl flex-col">
              {atEnd ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
                    <SquareCheck className="h-7 w-7" />
                  </span>
                  <p className="text-[15px] font-semibold">
                    Done — {deck.length} {deck.length === 1 ? "card" : "cards"}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startDrill(drill)}
                      className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Go again
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrill(null)}
                      className="rounded-lg border border-border/70 px-4 py-2 text-[13px] font-medium transition-colors hover:bg-white/[0.06]"
                    >
                      Back to Learn
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between text-[12px] text-muted-foreground">
                    <span className="tabular-nums">
                      {index + 1} / {deck.length}
                    </span>
                    <span className="rounded-full bg-white/[0.05] px-2 py-0.5 capitalize">
                      {current?.kind}
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-300"
                      style={{ width: `${(index / Math.max(1, deck.length)) * 100}%` }}
                    />
                  </div>

                  <div className="mt-5 flex-1 rounded-2xl border border-border/60 bg-[var(--surface-elevated)] p-6">
                    <p className="text-[16px] font-semibold leading-snug">{current?.front}</p>
                    {revealed ? (
                      <p className="mt-4 border-t border-border/50 pt-4 text-[14.5px] leading-relaxed text-muted-foreground">
                        {current?.back}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRevealed(true)}
                        className="mt-6 w-full rounded-xl border border-dashed border-border/70 py-4 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
                      >
                        Tap to reveal
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!revealed}
                    onClick={() => {
                      setIndex((i) => i + 1);
                      setRevealed(false);
                    }}
                    className="mt-4 w-full rounded-xl bg-primary py-3 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-35"
                  >
                    Next
                  </button>
                </>
              )}
            </div>
          ) : (
            /* ── Overview ──────────────────────────────────────────── */
            <div className="mx-auto max-w-xl space-y-5">
              {/* Smart notes */}
              <section className="rounded-2xl border border-border/60 bg-[var(--surface-elevated)] p-4">
                <span className="inline-flex items-center rounded-md border border-primary/40 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-primary">
                  Smart notes
                </span>
                {summary.length > 0 ? (
                  <ul className="mt-3 space-y-2.5">
                    {summary.slice(0, 4).map((c) => (
                      <li key={c.heading} className="text-[13.5px] leading-relaxed">
                        <span className="font-semibold">{c.heading}</span>
                        <span className="text-muted-foreground"> — {c.explanation}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3">
                    <p className="text-[13px] text-muted-foreground">
                      Generate a study guide and the key points from this note land here.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        closeSheet();
                        onGenerate();
                      }}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Generate
                    </button>
                  </div>
                )}
              </section>

              {/* Learn */}
              <section className="rounded-2xl border border-border/60 bg-[var(--surface-elevated)] p-4">
                <span className="inline-flex items-center rounded-md border border-primary/40 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-primary">
                  Learn
                </span>
                <h3 className="mt-3 text-[15.5px] font-semibold leading-snug">
                  {title || "Untitled note"}
                </h3>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {cards.length > 0
                    ? `${cards.length} ${cards.length === 1 ? "card" : "cards"} from your saved guides`
                    : "Start learning this content"}
                </p>

                <div className="mt-3.5 divide-y divide-border/50 overflow-hidden rounded-xl border border-border/50">
                  {(
                    [
                      ["flashcards", Layers],
                      ["questions", ListChecks],
                      ["mixed", SquareCheck],
                    ] as const
                  ).map(([d, Icon]) => {
                    const n = countFor(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={n === 0}
                        onClick={() => startDrill(d)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition-colors",
                          n === 0
                            ? "cursor-not-allowed opacity-40"
                            : "hover:bg-white/[0.05] active:bg-white/[0.08]",
                        )}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0 text-primary" />
                        <span className="flex-1 text-[14px] font-medium">{DRILL_LABEL[d]}</span>
                        {n > 0 && (
                          <span className="text-[12px] tabular-nums text-muted-foreground">
                            {n}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Ask */}
              <section className="rounded-2xl border border-border/60 bg-[var(--surface-elevated)] p-4">
                <span className="inline-flex items-center rounded-md border border-primary/40 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-primary">
                  Ask
                </span>
                {answer && (
                  <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white/[0.04] p-3.5 text-[13.5px] leading-relaxed">
                    {answer}
                  </p>
                )}
                <form
                  className="mt-3 flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const q = question.trim();
                    if (!q || askMutation.isPending) return;
                    setAnswer(null);
                    askMutation.mutate(q);
                  }}
                >
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask anything about your note"
                    aria-label="Ask anything about your note"
                    className="min-w-0 flex-1 rounded-xl border border-border/60 bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] outline-none placeholder:text-muted-foreground focus:border-primary/50"
                  />
                  <button
                    type="submit"
                    disabled={!question.trim() || askMutation.isPending}
                    aria-label="Send question"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-35"
                  >
                    {askMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </form>
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  Answers come from this note. Nobi says so when the note doesn&apos;t cover it.
                </p>
              </section>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
