export type NotebookColor = "violet" | "sky" | "emerald" | "amber" | "rose" | "indigo";

export interface StoredNotebook {
  id: string;
  name: string;
  emoji: string;
  color: NotebookColor;
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
    value:  "violet",
    label:  "Violet",
    bg:     "bg-primary/15",
    text:   "text-primary",
    ring:   "ring-primary/30",
    bar:    "from-violet-500 to-purple-500",
    glow:   "oklch(0.55 0.24 295 / 0.35)",
  },
  {
    value:  "sky",
    label:  "Sky",
    bg:     "bg-sky-500/15",
    text:   "text-sky-300",
    ring:   "ring-sky-400/30",
    bar:    "from-sky-400 to-cyan-400",
    glow:   "oklch(0.65 0.18 220 / 0.35)",
  },
  {
    value:  "emerald",
    label:  "Emerald",
    bg:     "bg-emerald-500/15",
    text:   "text-emerald-300",
    ring:   "ring-emerald-400/30",
    bar:    "from-emerald-400 to-teal-400",
    glow:   "oklch(0.65 0.18 160 / 0.35)",
  },
  {
    value:  "amber",
    label:  "Amber",
    bg:     "bg-amber-500/15",
    text:   "text-amber-300",
    ring:   "ring-amber-400/30",
    bar:    "from-amber-400 to-orange-400",
    glow:   "oklch(0.78 0.19 80 / 0.35)",
  },
  {
    value:  "rose",
    label:  "Rose",
    bg:     "bg-rose-500/15",
    text:   "text-rose-300",
    ring:   "ring-rose-400/30",
    bar:    "from-rose-400 to-pink-400",
    glow:   "oklch(0.65 0.22 10 / 0.35)",
  },
  {
    value:  "indigo",
    label:  "Indigo",
    bg:     "bg-indigo-500/15",
    text:   "text-indigo-300",
    ring:   "ring-indigo-400/30",
    bar:    "from-indigo-400 to-blue-500",
    glow:   "oklch(0.55 0.22 265 / 0.35)",
  },
];

export const NOTEBOOK_EMOJIS = [
  "📓","📚","🧬","🧪","⚗️","🔬","📐","📏","🧮","💡",
  "🌍","🏛️","⚖️","🎭","🎨","🎵","🔭","🧲","🌿","💊",
  "📖","✏️","🧠","💻","🫀","🧑‍🔬","🗺️","🏺","🎯","🔑",
];

// ── DB row shape ──────────────────────────────────────────────────────────────

export interface NotebookRow {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function rowToStoredNotebook(row: NotebookRow): StoredNotebook {
  return {
    id:        row.id,
    name:      row.name,
    emoji:     row.emoji,
    color:     row.color as NotebookColor,
    sortOrder: row.sort_order,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}
