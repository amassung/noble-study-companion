import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Plus, Flame, BookOpen, Timer, ArrowRight, CalendarClock } from "lucide-react";
import { useState } from "react";
import { NoteCard, type Note } from "@/components/NoteCard";
import { NoteEditor } from "@/components/NoteEditor";
import { createNote, daysUntil, deleteNote, formatRelative, formatTestCountdown, useNotes } from "@/lib/notes-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nobi — Home" },
      { name: "description", content: "Your study dashboard. Notes, AI study guides, and progress at a glance." },
      { property: "og:title", content: "Nobi — Home" },
      { property: "og:description", content: "Your study dashboard." },
    ],
  }),
  component: Home,
});

function Home() {
  const stored = useNotes();
  const [openId, setOpenId] = useState<string | null>(null);

  const notes: Note[] = stored.slice(0, 6).map((n) => ({
    id: n.id,
    subject: n.subject,
    subjectLabel: n.subjectLabel,
    title: n.title,
    preview: n.body,
    date: formatRelative(n.updatedAt),
    guideReady: n.body.length > 240,
    testDate: n.testDate ?? null,
  }));

  const upcoming = stored
    .filter((n) => n.testDate != null && daysUntil(n.testDate!) >= 0)
    .sort((a, b) => (a.testDate ?? 0) - (b.testDate ?? 0));

  const handleNew = () => {
    const note = createNote();
    setOpenId(note.id);
  };

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{
          background: "radial-gradient(ellipse at center, oklch(0.55 0.24 295 / 0.5), transparent 60%)",
        }}
      />

      <header className="animate-float-in">
        <p className="text-[12.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Thursday, June 4
        </p>
        <h1 className="mt-3 text-[34px] font-semibold leading-[1.05] tracking-tight text-foreground sm:text-[42px]">
          Good evening, Duke <span className="inline-block">👋</span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          You have <span className="font-medium text-foreground">2 tests</span> this week. Ready to study?
        </p>
      </header>

      <button
        className="group relative mt-8 flex w-full items-center gap-4 overflow-hidden rounded-xl border border-primary/30 bg-gradient-violet p-5 text-left shadow-glow-lg transition-transform duration-200 hover:scale-[1.005] active:scale-[0.995] sm:p-6 animate-float-in"
        style={{ animationDelay: "60ms" }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background: "radial-gradient(120% 100% at 0% 0%, oklch(1 0 0 / 0.18), transparent 50%)",
          }}
        />
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/25">
          <Sparkles className="h-5 w-5 text-white" strokeWidth={2.2} />
        </span>
        <span className="relative flex-1">
          <span className="block text-[15px] font-semibold text-white">Generate Study Guide</span>
          <span className="mt-0.5 block text-[13px] text-white/80">
            Turn your latest notes into a focused study session in seconds.
          </span>
        </span>
        <ArrowRight className="relative h-5 w-5 text-white/90 transition-transform group-hover:translate-x-0.5" />
      </button>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight">Recent notes</h2>
            <p className="text-[12.5px] text-muted-foreground">
              {stored.length === 0 ? "No notes yet — tap + to start." : "Pick up where you left off."}
            </p>
          </div>
          {stored.length > 0 && (
            <span className="text-[11.5px] text-muted-foreground lg:hidden">Swipe ← to delete</span>
          )}
        </div>

        {notes.length === 0 ? (
          <button
            onClick={handleNew}
            className="hover-glow flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-[var(--surface)]/40 py-14 text-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-violet text-white shadow-glow">
              <Plus className="h-5 w-5" />
            </span>
            <span className="mt-3 text-[14px] font-medium">Create your first note</span>
            <span className="mt-1 text-[12.5px] text-muted-foreground">Auto-saved as you type.</span>
          </button>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notes.map((n, i) => (
              <NoteCard
                key={n.id}
                note={n}
                style={{ animationDelay: `${120 + i * 70}ms` }}
                onOpen={setOpenId}
                onDelete={deleteNote}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={<BookOpen className="h-4 w-4" />}
          label="Notes this week"
          value={String(stored.length)}
          delta="+4 vs last week"
        />
        <StatCard
          icon={<Timer className="h-4 w-4" />}
          label="Study sessions"
          value="7"
          delta="3h 42m total"
        />
        <StatCard
          icon={<Flame className="h-4 w-4" />}
          label="Current streak"
          value="9 days"
          delta="Keep it going 🔥"
          accent
        />
      </section>

      <button
        aria-label="New note"
        onClick={handleNew}
        className="animate-pulse-glow fixed bottom-24 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-violet text-white transition-transform hover:scale-105 active:scale-95 lg:bottom-8 lg:right-8 lg:h-16 lg:w-16"
      >
        <Plus className="h-6 w-6" strokeWidth={2.4} />
      </button>

      {openId && <NoteEditor noteId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  delta,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "hover-glow rounded-xl border border-border/60 bg-[var(--surface)] p-4 shadow-card transition-colors",
        accent ? "bg-gradient-violet-soft" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
        <span
          className={[
            "flex h-6 w-6 items-center justify-center rounded-md ring-1 ring-inset",
            accent
              ? "bg-primary/20 text-primary ring-primary/30"
              : "bg-white/[0.04] text-foreground/80 ring-white/[0.06]",
          ].join(" ")}
        >
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-[26px] font-semibold tracking-tight">{value}</div>
        <div className="text-[12px] text-muted-foreground">{delta}</div>
      </div>
    </div>
  );
}
