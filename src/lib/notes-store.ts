import { useSyncExternalStore } from "react";
import type { Subject } from "@/components/NoteCard";
import type { StudyGuide } from "@/lib/study-guide.functions";

export type SavedGuide = {
  id: string;
  createdAt: number;
  guide: StudyGuide;
};

export type StoredNote = {
  guides?: SavedGuide[];
  id: string;
  title: string;
  body: string;
  subject: Subject;
  subjectLabel?: string;
  createdAt: number;
  updatedAt: number;
};

const KEY = "nobi.notes.v1";
const SUBJECTS: Subject[] = ["violet", "blue", "green", "amber"];

const isBrowser = typeof window !== "undefined";

const seed: StoredNote[] = [
  {
    id: "seed-1",
    title: "Kant's Categorical Imperative",
    body: "Act only according to that maxim by which you can at the same time will that it should become a universal law. The CI tests the universalizability of a maxim — if it cannot be willed universally without contradiction, it is impermissible.",
    subject: "violet",
    subjectLabel: "Philosophy",
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
    updatedAt: Date.now() - 1000 * 60 * 60 * 3,
  },
  {
    id: "seed-2",
    title: "Cellular Respiration — Krebs Cycle",
    body: "Acetyl-CoA enters the mitochondrial matrix and combines with oxaloacetate to form citrate. A series of redox reactions regenerates oxaloacetate while producing NADH, FADH2, ATP, and CO2.",
    subject: "blue",
    subjectLabel: "Biology",
    createdAt: Date.now() - 1000 * 60 * 60 * 26,
    updatedAt: Date.now() - 1000 * 60 * 60 * 26,
  },
  {
    id: "seed-3",
    title: "Elasticity of Demand",
    body: "Measures how quantity demanded responds to a change in price. Necessities tend toward inelastic; luxuries elastic. PED = %ΔQ / %ΔP.",
    subject: "green",
    subjectLabel: "Economics",
    createdAt: Date.now() - 1000 * 60 * 60 * 60,
    updatedAt: Date.now() - 1000 * 60 * 60 * 60,
  },
];

let cache: StoredNote[] = load();
const listeners = new Set<() => void>();

function load(): StoredNote[] {
  if (!isBrowser) return seed;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      window.localStorage.setItem(KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as StoredNote[];
    return seed;
  } catch {
    return seed;
  }
}

function persist() {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* ignore quota errors */
  }
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return cache;
}

function getServerSnapshot() {
  return seed;
}

export function useNotes(): StoredNote[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function getNote(id: string): StoredNote | undefined {
  return cache.find((n) => n.id === id);
}

function nextSubject(): Subject {
  const used = cache.length;
  return SUBJECTS[used % SUBJECTS.length];
}

export function createNote(): StoredNote {
  const now = Date.now();
  const note: StoredNote = {
    id: `n_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    body: "",
    subject: nextSubject(),
    createdAt: now,
    updatedAt: now,
  };
  cache = [note, ...cache];
  persist();
  emit();
  return note;
}

export function updateNote(id: string, patch: Partial<Pick<StoredNote, "title" | "body" | "subject" | "subjectLabel">>) {
  let changed = false;
  cache = cache.map((n) => {
    if (n.id !== id) return n;
    changed = true;
    return { ...n, ...patch, updatedAt: Date.now() };
  });
  if (changed) {
    persist();
    emit();
  }
}

export function deleteNote(id: string) {
  const before = cache.length;
  cache = cache.filter((n) => n.id !== id);
  if (cache.length !== before) {
    persist();
    emit();
  }
}

export function addGuide(noteId: string, guide: StudyGuide): SavedGuide {
  const saved: SavedGuide = {
    id: `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
    guide,
  };
  cache = cache.map((n) =>
    n.id === noteId ? { ...n, guides: [saved, ...(n.guides ?? [])], updatedAt: Date.now() } : n,
  );
  persist();
  emit();
  return saved;
}

export function deleteGuide(noteId: string, guideId: string) {
  cache = cache.map((n) =>
    n.id === noteId ? { ...n, guides: (n.guides ?? []).filter((g) => g.id !== guideId) } : n,
  );
  persist();
  emit();
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
