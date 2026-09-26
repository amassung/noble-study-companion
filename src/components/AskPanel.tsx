import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { askNote } from "@/lib/notes/ask-note.functions";
import { plainTextFromHtml } from "@/lib/study/note-text";
import { cn } from "@/lib/utils";

interface Turn {
  question: string;
  answer: string | null;
}

/**
 * Ask questions about a note without leaving it.
 *
 * This existed already, behind a full-screen sheet — which meant asking "what
 * were the signs of fluid overload again?" hid the page that would have shown
 * you. A student checking their own notes needs to see them and the answer at
 * once, so the panel docks beside the page instead of covering it.
 *
 * It also keeps the thread. One-shot question-and-answer loses the follow-up,
 * and following up is most of how anyone actually revises.
 */
export function AskPanel({
  title,
  body,
  onClose,
  onUsed,
}: {
  title: string;
  body: string;
  onClose: () => void;
  /** Fired after each answer, so the AI allowance can be refreshed. */
  onUsed?: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const ask = useServerFn(askNote);

  const askMutation = useMutation({
    mutationFn: (q: string) => ask({ data: { question: q, title, body: plainTextFromHtml(body) } }),
    onSuccess: (r) => {
      setTurns((t) =>
        t.map((turn, i) => (i === t.length - 1 ? { ...turn, answer: r.answer } : turn)),
      );
      onUsed?.();
    },
    onError: (e: Error) => {
      // Drop the unanswered turn: a question left hanging in the thread reads
      // as though an answer is still coming.
      setTurns((t) => t.slice(0, -1));
      toast.error(e.message || "Couldn't answer that.");
      onUsed?.();
    },
  });

  // Follow the conversation as it grows.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const submit = () => {
    const q = question.trim();
    if (!q || askMutation.isPending) return;
    setTurns((t) => [...t, { question: q, answer: null }]);
    setQuestion("");
    askMutation.mutate(q);
  };

  const hasContent = plainTextFromHtml(body).length > 0;

  return (
    <aside
      aria-label="Ask about this note"
      className="z-30 flex w-[320px] shrink-0 flex-col border-l border-border/60 bg-[var(--surface-elevated)]/95 backdrop-blur-sm"
    >
      <header className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <h2 className="flex-1 text-[13px] font-semibold tracking-tight">Ask this note</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close ask panel"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {turns.length === 0 && (
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            {hasContent
              ? "Answers come from this note only. Nobi says so when the note doesn't cover something, rather than filling the gap."
              : "Nothing written here yet. Add notes, or convert your handwriting to text, and this can answer from them."}
          </p>
        )}

        {turns.map((turn, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary/15 px-3 py-2 text-[12.5px] text-foreground">
              {turn.question}
            </p>
            {turn.answer === null ? (
              <span className="flex items-center gap-2 px-1 text-[12px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reading your note…
              </span>
            ) : (
              <p className="w-fit max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-[var(--surface)] px-3 py-2 text-[12.5px] leading-relaxed text-foreground ring-1 ring-inset ring-border/50">
                {turn.answer}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-border/50 p-2.5">
        <div className="flex items-end gap-1.5">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter breaks the line, as anywhere else.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="Ask about this note…"
            disabled={!hasContent}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-border/60 bg-[var(--surface)] px-2.5 py-2 text-[12.5px] outline-none placeholder:text-muted-foreground/70 focus:border-primary/50 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!question.trim() || askMutation.isPending || !hasContent}
            aria-label="Ask"
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors",
              "hover:bg-primary/90 disabled:opacity-35",
            )}
          >
            {askMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
