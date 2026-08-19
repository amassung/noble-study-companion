import type { StoredNote } from "@/lib/notes/types";
import type { StoredNotebook } from "@/lib/notebooks/types";

export type SearchHitField = "title" | "body" | "guide" | "notebook";

export interface SearchHit {
  note: StoredNote;
  score: number;
  /** Where the strongest match was found, for the result label. */
  field: SearchHitField;
  /** Plain-text excerpt around the match. */
  snippet: string;
  /** Ranges within `snippet` to highlight. */
  ranges: [number, number][];
  notebookName?: string;
}

/**
 * Note bodies are Tiptap HTML. Strip tags for searching and for snippets so a
 * student never sees markup — and so searching "strong" doesn't match every
 * bolded word's tag.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<img[^>]*>/gi, " ") // slide images carry huge attrs; drop entirely
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(s: string): string {
  return s.toLowerCase();
}

/** Flatten a note's saved study guides into searchable text. */
function guideText(note: StoredNote): string {
  if (!note.guides?.length) return "";
  return note.guides
    .map((g) =>
      [
        g.guide.title,
        ...(g.guide.keyConcepts ?? []).map((c) => `${c.heading} ${c.explanation}`),
        ...(g.guide.importantTerms ?? []).map((t) => `${t.term} ${t.definition}`),
        ...(g.guide.practiceQuestions ?? []).map((q) => `${q.question} ${q.answer}`),
      ].join(" "),
    )
    .join(" ");
}

/** All match ranges of any term within `text` (already normalized lengths). */
function findRanges(text: string, terms: string[]): [number, number][] {
  const lower = normalize(text);
  const ranges: [number, number][] = [];
  for (const term of terms) {
    let from = 0;
    for (;;) {
      const i = lower.indexOf(term, from);
      if (i === -1) break;
      ranges.push([i, i + term.length]);
      from = i + term.length;
    }
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

/**
 * Build a readable excerpt centred on the first match, with the highlight
 * ranges rebased onto the excerpt.
 */
function buildSnippet(
  text: string,
  terms: string[],
  max = 160,
): { snippet: string; ranges: [number, number][] } {
  if (!text) return { snippet: "", ranges: [] };
  const all = findRanges(text, terms);
  if (all.length === 0) {
    const snippet = text.slice(0, max);
    return { snippet: snippet + (text.length > max ? "…" : ""), ranges: [] };
  }

  const first = all[0][0];
  // Start a little before the match so it reads in context, on a word boundary.
  let start = Math.max(0, first - 60);
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space !== -1 && space < first) start = space + 1;
  }
  const end = Math.min(text.length, start + max);
  const slice = text.slice(start, end);

  const ranges = all
    .filter(([s, e]) => s >= start && e <= end)
    .map(([s, e]): [number, number] => [s - start, e - start]);

  return {
    snippet: (start > 0 ? "…" : "") + slice + (end < text.length ? "…" : ""),
    // Shift ranges right by the leading ellipsis if we added one.
    ranges: start > 0 ? ranges.map(([s, e]): [number, number] => [s + 1, e + 1]) : ranges,
  };
}

/**
 * Rank notes against a query. Every term must appear somewhere in the note
 * (AND semantics) — searching "krebs cycle" should not return every note
 * mentioning "cycle".
 */
export function searchNotes(
  notes: StoredNote[],
  notebooks: StoredNotebook[],
  query: string,
): SearchHit[] {
  const terms = normalize(query)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (terms.length === 0) return [];

  const notebookById = new Map(notebooks.map((n) => [n.id, n]));
  const hits: SearchHit[] = [];

  for (const note of notes) {
    const notebook = note.notebookId ? notebookById.get(note.notebookId) : undefined;
    const title = note.title ?? "";
    const bodyText = stripHtml(note.body ?? "");
    const guide = guideText(note);
    const notebookName = notebook?.name ?? "";
    const subject = note.subjectLabel ?? "";

    const haystacks = {
      title: normalize(title),
      body: normalize(bodyText),
      guide: normalize(guide),
      notebook: normalize(`${notebookName} ${subject}`),
    };

    // AND: skip the note unless every term appears somewhere.
    const matchesAll = terms.every((t) => Object.values(haystacks).some((h) => h.includes(t)));
    if (!matchesAll) continue;

    // Score by where matches land — a title hit is what the student meant.
    let score = 0;
    let field: SearchHitField = "body";
    for (const t of terms) {
      if (haystacks.title.includes(t)) {
        score += haystacks.title === t ? 120 : 60;
        field = "title";
      }
      if (haystacks.body.includes(t)) score += 20;
      if (haystacks.guide.includes(t)) score += 12;
      if (haystacks.notebook.includes(t)) score += 8;
    }
    if (field !== "title") {
      if (terms.some((t) => haystacks.body.includes(t))) field = "body";
      else if (terms.some((t) => haystacks.guide.includes(t))) field = "guide";
      else field = "notebook";
    }
    // Nudge recently edited notes up when scores tie.
    score += Math.min(10, (note.updatedAt ?? 0) / 1e12);

    // Snippet comes from wherever the match actually is, so the result shows
    // the matching sentence rather than always the first line of the note.
    const source =
      field === "title"
        ? bodyText || title
        : field === "guide"
          ? guide
          : field === "notebook"
            ? bodyText
            : bodyText;
    const { snippet, ranges } = buildSnippet(source, terms);

    hits.push({
      note,
      score,
      field,
      snippet,
      ranges,
      notebookName: notebook?.name,
    });
  }

  return hits.sort((a, b) => b.score - a.score);
}
