export type NotebookColor = "violet" | "sky" | "emerald" | "amber" | "rose" | "indigo";

// Paper templates rendered behind note content (GoodNotes-style). Each maps
// to a CSS background class defined in styles.css (.paper-<value>).
export type PaperTemplate = "blank" | "ruled" | "ruled-wide" | "dotted" | "grid";

export interface StoredNotebook {
  id: string;
  name: string;
  emoji: string;
  color: NotebookColor;
  paper: PaperTemplate;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

// ── Color config ──────────────────────────────────────────────────────────────

export const NOTEBOOK_COLORS: {
  value: NotebookColor;
  label: string;
  bg: string;
  text: string;
  ring: string;
  bar: string;
  glow: string;
}[] = [
  {
    value: "violet",
    label: "Violet",
    bg: "bg-primary/15",
    text: "text-primary",
    ring: "ring-primary/30",
    bar: "from-violet-500 to-purple-500",
    glow: "oklch(0.55 0.24 295 / 0.35)",
  },
  {
    value: "sky",
    label: "Sky",
    bg: "bg-sky-500/15",
    text: "text-sky-300",
    ring: "ring-sky-400/30",
    bar: "from-sky-400 to-cyan-400",
    glow: "oklch(0.65 0.18 220 / 0.35)",
  },
  {
    value: "emerald",
    label: "Emerald",
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    ring: "ring-emerald-400/30",
    bar: "from-emerald-400 to-teal-400",
    glow: "oklch(0.65 0.18 160 / 0.35)",
  },
  {
    value: "amber",
    label: "Amber",
    bg: "bg-amber-500/15",
    text: "text-amber-300",
    ring: "ring-amber-400/30",
    bar: "from-amber-400 to-orange-400",
    glow: "oklch(0.78 0.19 80 / 0.35)",
  },
  {
    value: "rose",
    label: "Rose",
    bg: "bg-rose-500/15",
    text: "text-rose-300",
    ring: "ring-rose-400/30",
    bar: "from-rose-400 to-pink-400",
    glow: "oklch(0.65 0.22 10 / 0.35)",
  },
  {
    value: "indigo",
    label: "Indigo",
    bg: "bg-indigo-500/15",
    text: "text-indigo-300",
    ring: "ring-indigo-400/30",
    bar: "from-indigo-400 to-blue-500",
    glow: "oklch(0.55 0.22 265 / 0.35)",
  },
];

// ── Paper templates ────────────────────────────────────────────────────────────
// `className` is the CSS background class (see styles.css) used both for the
// picker swatch and the editor page background.
export const PAPER_TEMPLATES: {
  value: PaperTemplate;
  label: string;
  className: string;
}[] = [
  { value: "blank", label: "Blank", className: "paper-blank" },
  { value: "ruled", label: "Ruled", className: "paper-ruled" },
  { value: "ruled-wide", label: "Ruled Wide", className: "paper-ruled-wide" },
  { value: "dotted", label: "Dotted", className: "paper-dotted" },
  { value: "grid", label: "Grid", className: "paper-grid" },
];

export function paperClassName(paper: PaperTemplate | undefined): string {
  return PAPER_TEMPLATES.find((p) => p.value === paper)?.className ?? "paper-blank";
}

export const NOTEBOOK_EMOJIS = [
  "📓",
  "📚",
  "🧬",
  "🧪",
  "⚗️",
  "🔬",
  "📐",
  "📏",
  "🧮",
  "💡",
  "🌍",
  "🏛️",
  "⚖️",
  "🎭",
  "🎨",
  "🎵",
  "🔭",
  "🧲",
  "🌿",
  "💊",
  "📖",
  "✏️",
  "🧠",
  "💻",
  "🫀",
  "🧑‍🔬",
  "🗺️",
  "🏺",
  "🎯",
  "🔑",
];

// ── DB row shape ──────────────────────────────────────────────────────────────

export interface NotebookRow {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  color: string;
  paper: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function rowToStoredNotebook(row: NotebookRow): StoredNotebook {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    color: row.color as NotebookColor,
    paper: (row.paper as PaperTemplate) ?? "blank",
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}
