import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { InkCanvas, type InkStroke } from "@/components/InkCanvas";

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

  if (!import.meta.env.DEV) {
    return <p style={{ padding: 24 }}>Not available.</p>;
  }

  return (
    <div style={{ padding: 16 }}>
      <p data-testid="stroke-count">strokes: {strokes.length}</p>
      <p data-testid="point-counts">points: {strokes.map((s) => s.points.length).join(",")}</p>
      <pre data-testid="point-dump" style={{ fontSize: 11, maxHeight: 120, overflow: "auto" }}>
        {strokes[0] ? JSON.stringify(strokes[0].points.slice(0, 12)) : ""}
      </pre>
      <div
        data-testid="ink-host"
        style={{ position: "relative", width: 800, height: 600, background: "#fff" }}
      >
        <InkCanvas
          noteId="ink-lab"
          mode="pen"
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
        />
      </div>
    </div>
  );
}
