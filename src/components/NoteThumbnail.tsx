import { useId, useMemo } from "react";
import type { InkStroke } from "@/lib/ink/ink-api";
import type { PaperTemplate } from "@/lib/notebooks/types";
import { cn } from "@/lib/utils";

/**
 * A miniature of a note's actual page: its paper, its handwriting, and the
 * first few lines of its typed text.
 *
 * A list of rows reading "Untitled note — No content yet" gives a student no
 * way to find the lecture they want; a picture of the page does it at a
 * glance, which is why every serious notes app leads with one.
 *
 * Rendered as inline SVG rather than a canvas: a list can hold dozens of these
 * and each canvas would be its own GPU-backed surface, whereas the SVG is
 * static markup the browser can rasterise once and reuse.
 */

// The aspect the note page itself uses (see PAGE_HEIGHT in NoteEditor).
const PAGE_W = 768;
const PAGE_H = 1040;

/** Strip HTML to the words a reader would actually see. */
function textLines(html: string, maxLines: number): string[] {
  if (!html) return [];
  const text = html
    // Treat block boundaries as line breaks before stripping tags, or all the
    // paragraphs run together into one unreadable smear.
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, maxLines);
}

const PAPER_LINE = "rgba(37,99,235,0.16)";

/**
 * Faint rules/dots so a thumbnail of an empty page still reads as paper.
 *
 * Emitted as a tiled <pattern> rather than one element per rule: drawing the
 * grid cell by cell produced ~340 nodes and 27KB of markup for a single
 * thumbnail, which a list of twenty notes multiplies into half a megabyte of
 * DOM. A pattern is a handful of nodes at any page size.
 */
function PaperPattern({ paper, id }: { paper: PaperTemplate | undefined; id: string }) {
  if (!paper || paper === "blank") return null;
  const gap = paper === "ruled" ? 56 : paper === "ruled-wide" ? 76 : 48;
  return (
    <>
      <defs>
        <pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse">
          {paper === "dotted" ? (
            <circle cx={gap / 2} cy={gap / 2} r="2.5" fill={PAPER_LINE} />
          ) : (
            <>
              <rect x="0" y={gap - 2} width={gap} height="2" fill={PAPER_LINE} />
              {paper === "grid" && (
                <rect x={gap - 2} y="0" width="2" height={gap} fill={PAPER_LINE} />
              )}
            </>
          )}
        </pattern>
      </defs>
      <rect x="0" y="0" width={PAGE_W} height={PAGE_H} fill={`url(#${id})`} />
    </>
  );
}

export function NoteThumbnail({
  body,
  ink,
  paper,
  className,
}: {
  body: string;
  ink?: InkStroke[];
  paper?: PaperTemplate;
  className?: string;
}) {
  const lines = useMemo(() => textLines(body, 7), [body]);
  // Pattern ids must be unique: a list renders many of these at once and
  // duplicate ids would all resolve to whichever appeared first.
  const patternId = `nt-paper-${useId().replace(/:/g, "")}`;

  // Handwriting as polylines. Full perfect-freehand outlines carry far more
  // detail than a thumbnail can show, so a simple stroked path at the right
  // weight is both faster and visually indistinguishable at this size.
  const paths = useMemo(() => {
    if (!ink?.length) return [];
    return ink.slice(0, 400).map((s) => {
      const pts = s.points;
      // Thin dense strokes: neighbouring samples land on the same pixel here.
      const step = Math.max(1, Math.floor(pts.length / 60));
      const d: string[] = [];
      for (let i = 0; i < pts.length; i += step) {
        const [x, y] = pts[i];
        d.push(`${i === 0 ? "M" : "L"} ${(x * PAGE_W).toFixed(1)} ${y.toFixed(1)}`);
      }
      return {
        id: s.id,
        d: d.join(" "),
        color: s.color,
        width: Math.max(2, s.size),
        opacity: s.tool === "highlighter" ? 0.35 : s.tool === "pencil" ? 0.8 : 1,
      };
    });
  }, [ink]);

  const empty = !lines.length && !paths.length;

  return (
    <svg
      viewBox={`0 0 ${PAGE_W} ${PAGE_H}`}
      className={cn("block h-full w-full", className)}
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
    >
      <rect x="0" y="0" width={PAGE_W} height={PAGE_H} fill="var(--paper, #ffffff)" />
      <PaperPattern paper={paper} id={patternId} />

      {/* Typed text, as weighted bars. Real glyphs are illegible at thumbnail
          scale and cost a font load; bars convey density and layout, which is
          what a reader actually recognises a page by. */}
      {lines.map((line, i) => {
        const w = Math.min(PAGE_W - 96, 120 + line.length * 11);
        return (
          <rect
            key={i}
            x="48"
            y={70 + i * 62}
            width={w}
            height={i === 0 ? 26 : 18}
            rx={i === 0 ? 6 : 5}
            fill="currentColor"
            opacity={i === 0 ? 0.55 : 0.28}
          />
        );
      })}

      {paths.map((p) => (
        <path
          key={p.id}
          d={p.d}
          fill="none"
          stroke={p.color}
          strokeWidth={p.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={p.opacity}
        />
      ))}

      {empty && (
        <g opacity="0.18">
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x="48"
              y={90 + i * 62}
              width={i === 2 ? 300 : 520}
              height="18"
              rx="5"
              fill="currentColor"
            />
          ))}
        </g>
      )}
    </svg>
  );
}
