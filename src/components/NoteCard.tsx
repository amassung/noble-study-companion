import { Sparkles } from "lucide-react";

export type Subject = "violet" | "blue" | "green" | "amber";

const subjectStyles: Record<Subject, { bg: string; text: string; ring: string; label: string }> = {
  violet: { bg: "bg-primary/15", text: "text-primary", ring: "ring-primary/30", label: "Philosophy" },
  blue:   { bg: "bg-sky-500/15", text: "text-sky-300", ring: "ring-sky-400/30", label: "Biology" },
  green:  { bg: "bg-emerald-500/15", text: "text-emerald-300", ring: "ring-emerald-400/30", label: "Economics" },
  amber:  { bg: "bg-amber-500/15", text: "text-amber-300", ring: "ring-amber-400/30", label: "History" },
};

export type Note = {
  id: string;
  subject: Subject;
  subjectLabel?: string;
  title: string;
  preview: string;
  date: string;
  guideReady?: boolean;
};

export function NoteCard({ note, style }: { note: Note; style?: React.CSSProperties }) {
  const s = subjectStyles[note.subject];
  return (
    <article
      style={style}
      className="hover-glow group relative cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-[var(--surface)] p-5 shadow-card transition-transform duration-200 hover:-translate-y-0.5 animate-float-in"
    >
      {/* violet left border */}
      <span className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-gradient-to-b from-primary to-secondary opacity-80 group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${s.bg} ${s.text} ${s.ring}`}
        >
          {note.subjectLabel ?? s.label}
        </span>
        {note.guideReady && (
          <span
            title="Study guide ready"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-primary/30"
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
          </span>
        )}
      </div>

      <h3 className="mt-3 text-[15px] font-semibold tracking-tight text-foreground">
        {note.title}
      </h3>
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
        {note.preview}
      </p>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11.5px] text-muted-foreground">{note.date}</span>
        <span className="text-[11.5px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Open →
        </span>
      </div>
    </article>
  );
}
