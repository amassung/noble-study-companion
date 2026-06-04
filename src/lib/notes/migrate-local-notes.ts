import type { Subject } from "@/components/NoteCard";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { StudyGuide } from "@/lib/study-guide.functions";

const LOCAL_NOTES_KEY = "nobi.notes.v1";
const MIGRATED_KEY = "nobi.migrated.v1";

type LegacySavedGuide = {
  id: string;
  createdAt: number;
  guide: StudyGuide;
};

type LegacyNote = {
  id: string;
  title: string;
  body: string;
  subject: Subject;
  subjectLabel?: string;
  testDate?: number | null;
  createdAt: number;
  updatedAt: number;
  guides?: LegacySavedGuide[];
};

function readLegacyNotes(): LegacyNote[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_NOTES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as LegacyNote[];
  } catch {
    return null;
  }
}

/**
 * Imports notes from localStorage into Supabase once per browser profile.
 */
export async function migrateLocalNotesIfNeeded(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(MIGRATED_KEY) === userId) return;

  const legacy = readLegacyNotes();
  if (!legacy?.length) {
    window.localStorage.setItem(MIGRATED_KEY, userId);
    return;
  }

  const supabase = getSupabaseClient();

  const { count, error: countError } = await supabase
    .from("notes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    window.localStorage.setItem(MIGRATED_KEY, userId);
    window.localStorage.removeItem(LOCAL_NOTES_KEY);
    return;
  }

  for (const note of legacy) {
    const { data: inserted, error: noteError } = await supabase
      .from("notes")
      .insert({
        user_id: userId,
        title: note.title ?? "",
        body: note.body ?? "",
        subject: note.subject,
        subject_label: note.subjectLabel ?? null,
        test_date: note.testDate != null ? new Date(note.testDate).toISOString() : null,
        created_at: new Date(note.createdAt).toISOString(),
        updated_at: new Date(note.updatedAt).toISOString(),
      })
      .select("id")
      .single();

    if (noteError) throw noteError;

    const guides = note.guides ?? [];
    if (guides.length > 0) {
      const rows = guides.map((g) => ({
        note_id: inserted.id,
        user_id: userId,
        guide: g.guide,
        created_at: new Date(g.createdAt).toISOString(),
      }));
      const { error: guidesError } = await supabase.from("study_guides").insert(rows);
      if (guidesError) throw guidesError;
    }
  }

  window.localStorage.setItem(MIGRATED_KEY, userId);
  window.localStorage.removeItem(LOCAL_NOTES_KEY);
}
