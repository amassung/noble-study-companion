import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, FileText, Search as SearchIcon, Sparkles, X as XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnnotationProvider } from "@/components/AnnotationContext";
import { NoteEditor } from "@/components/NoteEditor";
import { formatRelative } from "@/lib/notes/format";
import { useNotebooks } from "@/lib/notebooks/use-notebooks";
import { useNotes, useNotesList } from "@/lib/notes/use-notes";
import { searchNotes, type SearchHit } from "@/lib/search/search";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Nobi — Search" }] }),
  component: SearchPage,
});

/** Renders a snippet with the matched terms highlighted. */
function Highlighted({ text, ranges }: { text: string; ranges: [number, number][] }) {
  if (ranges.length === 0) return <>{text}</>;
  const out: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    // Ranges are sorted; skip any that overlap one already rendered.
    if (start < cursor) return;
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push(
      <mark key={i} className="rounded-[3px] bg-primary/25 px-0.5 text-foreground">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
}

const FIELD_LABEL: Record<SearchHit["field"], { label: string; icon: React.ReactNode }> = {
  title: { label: "Title", icon: <FileText className="h-3 w-3" /> },
  body: { label: "Note", icon: <FileText className="h-3 w-3" /> },
  guide: { label: "Study guide", icon: <Sparkles className="h-3 w-3" /> },
  notebook: { label: "Notebook", icon: <BookOpen className="h-3 w-3" /> },
};

function SearchPage() {
  const { isLoading } = useNotesList();
  const notes = useNotes();
  const notebooks = useNotebooks();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Searching runs over the already-cached notes, so results are instant and
  // work with no connection.
  const hits = useMemo(
    () => (query.trim() ? searchNotes(notes, notebooks, query) : []),
    [notes, notebooks, query],
  );

  const trimmed = query.trim();

  return (
    <div className="animate-float-in mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="bg-gradient-violet-soft flex h-10 w-10 items-center justify-center rounded-xl text-primary ring-1 ring-primary/30">
          <SearchIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Search</h1>
          <p className="text-[12.5px] text-muted-foreground">
            Every note, notebook, and study guide — works offline.
          </p>
        </div>
      </div>

      {/* Query input */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your notes…"
          aria-label="Search your notes"
          className="w-full rounded-xl border border-border/60 bg-[var(--surface)] py-3 pl-10 pr-10 text-[14.5px] text-foreground shadow-card placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Results */}
      <div className="mt-5">
        {isLoading ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">Loading your notes…</p>
        ) : !trimmed ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">
            Start typing to search {notes.length} {notes.length === 1 ? "note" : "notes"}.
          </p>
        ) : hits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-[var(--surface)]/40 px-4 py-10 text-center">
            <p className="text-[13.5px] font-medium text-foreground">No matches for “{trimmed}”</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Try a single keyword, or check another notebook.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-2.5 text-[12px] text-muted-foreground">
              {hits.length} {hits.length === 1 ? "result" : "results"}
            </p>
            <div className="space-y-2">
              {hits.map((hit) => {
                const meta = FIELD_LABEL[hit.field];
                return (
                  <button
                    key={hit.note.id}
                    onClick={() => setOpenId(hit.note.id)}
                    className={cn(
                      "hover-glow block w-full rounded-xl border border-border/60 bg-[var(--surface)] p-4 text-left transition-colors hover:border-primary/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[14.5px] font-semibold tracking-tight text-foreground">
                        {hit.note.title || "Untitled note"}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                        {meta.icon}
                        {meta.label}
                      </span>
                    </div>

                    {hit.snippet && (
                      <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                        <Highlighted text={hit.snippet} ranges={hit.ranges} />
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground/80">
                      {hit.notebookName && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {hit.notebookName}
                        </span>
                      )}
                      {hit.note.subjectLabel && <span>{hit.note.subjectLabel}</span>}
                      <span>{formatRelative(hit.note.updatedAt)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {openId && (
        <AnnotationProvider>
          <NoteEditor noteId={openId} onClose={() => setOpenId(null)} />
        </AnnotationProvider>
      )}
    </div>
  );
}
