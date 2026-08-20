import type { StoredNote } from "@/lib/notes/types";

export type CardKind = "term" | "concept" | "question";

export interface Card {
  /** Stable across guide regeneration — derived from the front text. */
  key: string;
  noteId: string;
  noteTitle: string;
  kind: CardKind;
  front: string;
  back: string;
}

export interface CardProgress {
  cardKey: string;
  noteId: string;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: number;
}

/** Cheap, stable string hash (djb2) — card keys must survive regeneration. */
function hashKey(kind: CardKind, front: string): string {
  const s = `${kind}:${front.trim().toLowerCase()}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `${kind}-${h.toString(36)}`;
}

/**
 * Turn a note's saved study guides into flashcards.
 *
 * The AI already produces exactly the right raw material — terms with
 * definitions, concepts with explanations, practice questions with answers —
 * so studying is a matter of presenting it as active recall rather than
 * something to re-read.
 */
export function cardsForNote(note: StoredNote): Card[] {
  const guides = note.guides ?? [];
  if (guides.length === 0) return [];

  // Newest guide wins if the same front text appears more than once.
  const byKey = new Map<string, Card>();
  for (const saved of [...guides].reverse()) {
    const g = saved.guide;
    const push = (kind: CardKind, front: string, back: string) => {
      const f = (front ?? "").trim();
      const b = (back ?? "").trim();
      if (!f || !b) return;
      const key = hashKey(kind, f);
      byKey.set(key, {
        key,
        noteId: note.id,
        noteTitle: note.title || "Untitled note",
        kind,
        front: f,
        back: b,
      });
    };

    for (const t of g.importantTerms ?? []) push("term", t.term, t.definition);
    for (const c of g.keyConcepts ?? []) push("concept", c.heading, c.explanation);
    for (const q of g.practiceQuestions ?? []) push("question", q.question, q.answer);
  }
  return [...byKey.values()];
}

export function allCards(notes: StoredNote[]): Card[] {
  return notes.flatMap(cardsForNote);
}

export type Grade = "again" | "good" | "easy";

/**
 * SM-2 style scheduling, simplified to three buttons.
 *
 * Deliberately conservative: a lapse drops the card back to same-day review
 * rather than burying it, because a student cramming for Thursday's midterm
 * needs the card they just missed to come back in this session.
 */
export function schedule(
  prev: CardProgress | undefined,
  grade: Grade,
  now = Date.now(),
): CardProgress {
  const ease = prev?.ease ?? 2.5;
  const reps = prev?.reps ?? 0;
  const lapses = prev?.lapses ?? 0;

  if (grade === "again") {
    return {
      cardKey: prev?.cardKey ?? "",
      noteId: prev?.noteId ?? "",
      // Floor the ease so a hard card never becomes impossible to schedule.
      ease: Math.max(1.3, ease - 0.2),
      intervalDays: 0,
      reps: 0,
      lapses: lapses + 1,
      // ~10 minutes: comes back before the session ends.
      dueAt: now + 10 * 60 * 1000,
    };
  }

  const nextEase = grade === "easy" ? ease + 0.15 : ease;
  let intervalDays: number;
  if (reps === 0) intervalDays = grade === "easy" ? 3 : 1;
  else if (reps === 1) intervalDays = grade === "easy" ? 6 : 3;
  else
    intervalDays = Math.round((prev?.intervalDays || 1) * nextEase * (grade === "easy" ? 1.3 : 1));

  return {
    cardKey: prev?.cardKey ?? "",
    noteId: prev?.noteId ?? "",
    ease: Math.min(3.2, nextEase),
    intervalDays,
    reps: reps + 1,
    lapses,
    dueAt: now + intervalDays * 24 * 60 * 60 * 1000,
  };
}

/** Cards with no progress are new (due now); otherwise honour dueAt. */
export function dueCards(
  cards: Card[],
  progress: Map<string, CardProgress>,
  now = Date.now(),
): Card[] {
  return cards.filter((c) => {
    const p = progress.get(c.key);
    return !p || p.dueAt <= now;
  });
}

export const CARD_KIND_LABEL: Record<CardKind, string> = {
  term: "Term",
  concept: "Concept",
  question: "Question",
};
