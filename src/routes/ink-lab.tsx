import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { InkCanvas, type InkStroke } from "@/components/InkCanvas";
import { NotebookCover, VirtualNotebookCover } from "@/components/NotebookCover";
import { NOTEBOOK_COLORS, type StoredNotebook } from "@/lib/notebooks/types";

/**
 * A bench for the ink engine.
 *
 * The handwriting bugs only appear on a real iPad with a real hand on the
 * glass, and every round of diagnosis so far has cost the user a test cycle.
 * This mounts the actual InkCanvas — not a copy of its logic — with stub
 * props and no auth, so synthetic pointer sequences can be driven at it and
 * the result inspected directly.
 *
 * Dev only: the route refuses to render in production.
 */
export const Route = createFileRoute("/ink-lab")({
  head: () => ({ meta: [{ title: "Ink lab" }] }),
  component: InkLab,
});

function InkLab() {
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const nextId = useRef(1);
  const [mode, setMode] = useState<"pen" | "select" | "eraser">("pen");

  if (!import.meta.env.DEV) {
    return <p style={{ padding: 24 }}>Not available.</p>;
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {(["pen", "select", "eraser"] as const).map((m) => (
          <button
            key={m}
            data-testid={`mode-${m}`}
            onClick={() => setMode(m)}
            style={{ padding: "4px 10px", fontWeight: mode === m ? 700 : 400 }}
          >
            {m}
          </button>
        ))}
      </div>
      <p data-testid="stroke-count">strokes: {strokes.length}</p>
      <p data-testid="point-counts">points: {strokes.map((s) => s.points.length).join(",")}</p>
      <pre data-testid="point-dump" style={{ fontSize: 11, maxHeight: 120, overflow: "auto" }}>
        {strokes[0] ? JSON.stringify(strokes[0].points.slice(0, 12)) : ""}
      </pre>
      {/* The notebook shelf, so its appearance can be checked without an
          account. Every colour at once is the useful view: a cover that only
          works in violet is not a cover. */}
      <div data-testid="shelf" style={{ marginBottom: 24, maxWidth: 900 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0,1fr))",
            columnGap: 16,
            rowGap: 24,
          }}
        >
          <VirtualNotebookCover label="All Notes" emoji="📚" noteCount={12} onOpen={() => {}} />
          {NOTEBOOK_COLORS.map((c, i) => (
            <NotebookCover
              key={c.value}
              notebook={
                {
                  id: c.value,
                  name: ["Pharmacology", "Adult Health I", "Patho", "Lifespan", "Ethics"][i % 5],
                  emoji: ["🧬", "💊", "🩺", "🧪", "📐"][i % 5],
                  color: c.value,
                } as StoredNotebook
              }
              noteCount={i + 1}
              onOpen={() => {}}
            />
          ))}
        </div>
      </div>

      <div
        data-testid="ink-host"
        style={{ position: "relative", width: 800, height: 600, background: "#fff" }}
      >
        <InkCanvas
          noteId="ink-lab"
          mode={mode}
          color="#1f2937"
          size={3}
          strokes={strokes}
          addStroke={(s) =>
            setStrokes((prev) => [
              ...prev,
              { ...s, id: `s${nextId.current++}`, noteId: "ink-lab" } as InkStroke,
            ])
          }
          eraseStrokes={(ids) => setStrokes((prev) => prev.filter((s) => !ids.includes(s.id)))}
          restyleStrokes={(ids, patch) =>
            setStrokes((prev) =>
              prev.map((s) => (ids.includes(s.id) ? { ...s, color: patch.color } : s)),
            )
          }
          moveStrokes={(updates) =>
            setStrokes((prev) =>
              prev.map((s) => {
                const u = updates.find((x) => x.id === s.id);
                return u ? { ...s, points: u.points, size: u.size } : s;
              }),
            )
          }
        />
      </div>
    </div>
  );
}
