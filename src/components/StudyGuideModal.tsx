import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, X, Copy, Download, Check, AlertCircle, BookOpen, Tag, HelpCircle } from "lucide-react";
import { jsPDF } from "jspdf";
import { generateStudyGuide, type StudyGuide } from "@/lib/study-guide.functions";
import { useAddGuideMutation } from "@/lib/notes/use-notes";

type Props = {
  open: boolean;
  onClose: () => void;
  note: { title: string; body: string; subjectLabel?: string };
  noteId?: string;
  initialGuide?: StudyGuide;
};

export function StudyGuideModal({ open, onClose, note, noteId, initialGuide }: Props) {
  const callGenerate = useServerFn(generateStudyGuide);
  const addGuideMutation = useAddGuideMutation();
  const [guide, setGuide] = useState<StudyGuide | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initialGuide) {
      setGuide(initialGuide);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setGuide(null);
    setError(null);
    setLoading(true);

    callGenerate({
      data: {
        title: note.title,
        body: note.body,
        subjectLabel: note.subjectLabel,
      },
    })
      .then((g) => {
        if (cancelled) return;
        setGuide(g);
        if (noteId) addGuideMutation.mutate({ noteId, guide: g });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Something went wrong.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addGuideMutation is stable enough; avoid re-fetching guide
  }, [open, note.title, note.body, note.subjectLabel, callGenerate, noteId, initialGuide]);

  if (!open) return null;

  const handleCopy = async () => {
    if (!guide) return;
    const text = guideToPlainText(guide);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  };

  const handleExport = () => {
    if (!guide) return;
    exportGuideToPdf(guide, note.subjectLabel);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-float-in"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border/60 bg-[var(--surface-elevated)] shadow-glow-lg sm:max-h-[88vh] sm:rounded-2xl"
        style={{ animation: "sheet-up 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both" }}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-white/15" />
        </div>

        {/* Header */}
        <header className="flex items-start justify-between gap-3 border-b border-border/40 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-violet text-white shadow-glow">
              <Sparkles className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div>
              <h2 className="text-[16px] font-semibold tracking-tight">Study Guide</h2>
              <p className="line-clamp-1 text-[12px] text-muted-foreground">
                {guide?.title ?? note.title ?? "Generated from your notes"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-[var(--surface)] text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {loading && <LoadingShimmer />}
          {!loading && error && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-[13px]">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="font-medium text-foreground">{error}</p>
                <p className="mt-1 text-muted-foreground">
                  Try again or add more detail to your note for better results.
                </p>
              </div>
            </div>
          )}
          {!loading && !error && guide && <GuideContent guide={guide} />}
        </div>

        {/* Footer actions */}
        <footer className="flex items-center justify-end gap-2 border-t border-border/40 bg-[var(--surface)]/60 px-5 py-3.5 sm:px-6">
          <button
            onClick={handleCopy}
            disabled={!guide}
            className="hover-glow flex items-center gap-1.5 rounded-lg border border-border/60 bg-[var(--surface)] px-3.5 py-2 text-[13px] font-medium text-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={handleExport}
            disabled={!guide}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-violet px-3.5 py-2 text-[13px] font-semibold text-white shadow-glow transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>
        </footer>
      </div>

      {/* keyframes (scoped via style tag to keep design system in one place) */}
      <style>{`
        @keyframes sheet-up {
          from { opacity: 0; transform: translateY(24px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes nobi-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .nobi-shimmer {
          background-image: linear-gradient(
            90deg,
            oklch(0.28 0.02 295 / 0.4) 0%,
            oklch(0.55 0.24 295 / 0.35) 40%,
            oklch(0.63 0.24 300 / 0.4) 50%,
            oklch(0.55 0.24 295 / 0.35) 60%,
            oklch(0.28 0.02 295 / 0.4) 100%
          );
          background-size: 200% 100%;
          animation: nobi-shimmer 1.8s linear infinite;
        }
      `}</style>
    </div>
  );
}

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 last:mb-0">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
          {icon}
        </span>
        <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function GuideContent({ guide }: { guide: StudyGuide }) {
  return (
    <div className="animate-float-in">
      <Section icon={<BookOpen className="h-3.5 w-3.5" />} title="Key Concepts" count={guide.keyConcepts.length}>
        {guide.keyConcepts.map((c, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/60 bg-[var(--surface)] p-4"
          >
            <h4 className="text-[13.5px] font-semibold tracking-tight text-foreground">{c.heading}</h4>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{c.explanation}</p>
          </div>
        ))}
      </Section>

      <Section icon={<Tag className="h-3.5 w-3.5" />} title="Important Terms" count={guide.importantTerms.length}>
        <div className="grid grid-cols-1 gap-2">
          {guide.importantTerms.map((t, i) => (
            <div
              key={i}
              className="flex gap-3 rounded-xl border border-border/60 bg-[var(--surface)] p-3.5"
            >
              <div className="min-w-[110px] shrink-0">
                <span className="inline-flex rounded-md bg-primary/15 px-2 py-0.5 text-[12px] font-medium text-primary ring-1 ring-inset ring-primary/25">
                  {t.term}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{t.definition}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        icon={<HelpCircle className="h-3.5 w-3.5" />}
        title="Practice Questions"
        count={guide.practiceQuestions.length}
      >
        {guide.practiceQuestions.map((q, i) => (
          <details
            key={i}
            className="group rounded-xl border border-border/60 bg-[var(--surface)] p-4 transition-colors open:border-primary/30"
          >
            <summary className="flex cursor-pointer list-none items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary ring-1 ring-inset ring-primary/25">
                {i + 1}
              </span>
              <span className="flex-1 text-[13.5px] font-medium text-foreground">{q.question}</span>
              <span className="mt-0.5 text-[11px] font-medium text-primary opacity-80 group-open:opacity-0">
                Show
              </span>
            </summary>
            <p className="mt-3 border-t border-border/40 pt-3 text-[13px] leading-relaxed text-muted-foreground">
              {q.answer}
            </p>
          </details>
        ))}
      </Section>
    </div>
  );
}

function LoadingShimmer() {
  return (
    <div className="animate-float-in">
      {/* Glow pill */}
      <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-gradient-violet-soft px-3 py-1.5 text-[12px] font-medium text-primary shadow-glow">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        Nobi is generating your study guide…
      </div>

      {[0, 1, 2].map((s) => (
        <div key={s} className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="nobi-shimmer h-7 w-7 rounded-md" />
            <div className="nobi-shimmer h-3.5 w-32 rounded" />
          </div>
          <div className="space-y-2.5">
            {[0, 1, 2].map((r) => (
              <div key={r} className="rounded-xl border border-border/60 bg-[var(--surface)] p-4">
                <div className="nobi-shimmer mb-2 h-3.5 w-2/5 rounded" />
                <div className="nobi-shimmer mb-1.5 h-3 w-full rounded" />
                <div className="nobi-shimmer h-3 w-4/5 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function guideToPlainText(g: StudyGuide): string {
  const lines: string[] = [];
  lines.push(g.title.toUpperCase(), "");
  lines.push("KEY CONCEPTS");
  g.keyConcepts.forEach((c) => lines.push(`• ${c.heading}`, `  ${c.explanation}`));
  lines.push("", "IMPORTANT TERMS");
  g.importantTerms.forEach((t) => lines.push(`• ${t.term} — ${t.definition}`));
  lines.push("", "PRACTICE QUESTIONS");
  g.practiceQuestions.forEach((q, i) =>
    lines.push(`${i + 1}. ${q.question}`, `   Answer: ${q.answer}`),
  );
  return lines.join("\n");
}

function exportGuideToPdf(g: StudyGuide, subjectLabel?: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 54;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, size: number, opts: { bold?: boolean; color?: [number, number, number]; indent?: number; lineGap?: number } = {}) => {
    const { bold, color, indent = 0, lineGap = 2 } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(color ?? [30, 30, 30]));
    const lines = doc.splitTextToSize(text, contentW - indent) as string[];
    const lineH = size * 1.35;
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, margin + indent, y);
      y += lineH;
    }
    y += lineGap;
  };

  // Title block (violet bar)
  doc.setFillColor(124, 58, 237);
  doc.rect(margin, y, 4, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text(g.title, margin + 14, y + 20);
  y += 38;

  if (subjectLabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`${subjectLabel.toUpperCase()}  ·  Generated by Nobi`, margin, y);
    y += 18;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text("Generated by Nobi", margin, y);
    y += 18;
  }
  y += 8;

  const sectionHeading = (label: string) => {
    ensureSpace(36);
    y += 6;
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y, pageW - margin, y);
    y += 18;
    writeWrapped(label, 13, { bold: true, color: [124, 58, 237], lineGap: 6 });
  };

  sectionHeading("KEY CONCEPTS");
  g.keyConcepts.forEach((c) => {
    writeWrapped(c.heading, 12, { bold: true, color: [25, 25, 25], lineGap: 2 });
    writeWrapped(c.explanation, 11, { color: [60, 60, 60], lineGap: 8 });
  });

  sectionHeading("IMPORTANT TERMS");
  g.importantTerms.forEach((t) => {
    writeWrapped(`${t.term}`, 11.5, { bold: true, color: [25, 25, 25], lineGap: 1 });
    writeWrapped(t.definition, 11, { color: [60, 60, 60], indent: 12, lineGap: 6 });
  });

  sectionHeading("PRACTICE QUESTIONS");
  g.practiceQuestions.forEach((q, i) => {
    writeWrapped(`${i + 1}.  ${q.question}`, 11.5, { bold: true, color: [25, 25, 25], lineGap: 1 });
    writeWrapped(`Answer: ${q.answer}`, 11, { color: [70, 70, 70], indent: 14, lineGap: 8 });
  });

  const fileName = `${slug(g.title) || "study-guide"}.pdf`;
  doc.save(fileName);
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}
