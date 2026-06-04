import type { Subject } from "@/components/NoteCard";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { StudyGuide } from "@/lib/study-guide.functions";
import { NOTE_SUBJECTS, type SavedGuide, type StoredNote } from "./types";

type GuideRow = {
  id: string;
  guide: StudyGuide;
  created_at: string;
};

type NoteRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  subject: string;
  subject_label: string | null;
  test_date: string | null;
  created_at: string;
  updated_at: string;
  study_guides?: GuideRow[] | null;
};

function rowToStoredNote(row: NoteRow): StoredNote {
  const guides = (row.study_guides ?? [])
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(
      (g): SavedGuide => ({
        id: g.id,
        createdAt: new Date(g.created_at).getTime(),
        guide: g.guide,
      }),
    );

  return {
    id: row.id,
    title: row.title,
    body: row.body,
    subject: row.subject as Subject,
    subjectLabel: row.subject_label ?? undefined,
    testDate: row.test_date ? new Date(row.test_date).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    guides,
  };
}

const NOTE_SELECT = `
  id,
  user_id,
  title,
  body,
  subject,
  subject_label,
  test_date,
  created_at,
  updated_at,
  study_guides (
    id,
    guide,
    created_at
  )
`;

async function requireUserId(): Promise<string> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("Not signed in");
  return user.id;
}

export async function fetchNotes(): Promise<StoredNote[]> {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data as NoteRow[]).map(rowToStoredNote);
}

export async function createNote(): Promise<StoredNote> {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();

  const { count, error: countError } = await supabase
    .from("notes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (countError) throw countError;

  const subject = NOTE_SUBJECTS[(count ?? 0) % NOTE_SUBJECTS.length];

  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      title: "",
      body: "",
      subject,
    })
    .select(NOTE_SELECT)
    .single();

  if (error) throw error;
  return rowToStoredNote(data as NoteRow);
}

export type NotePatch = Partial<
  Pick<StoredNote, "title" | "body" | "subject" | "subjectLabel" | "testDate">
>;

export async function updateNote(id: string, patch: NotePatch): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();

  const row: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.body !== undefined) row.body = patch.body;
  if (patch.subject !== undefined) row.subject = patch.subject;
  if (patch.subjectLabel !== undefined) row.subject_label = patch.subjectLabel;
  if (patch.testDate !== undefined) {
    row.test_date = patch.testDate != null ? new Date(patch.testDate).toISOString() : null;
  }

  const { error } = await supabase.from("notes").update(row).eq("id", id).eq("user_id", userId);

  if (error) throw error;
}

export async function deleteNote(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();

  const { error } = await supabase.from("notes").delete().eq("id", id).eq("user_id", userId);

  if (error) throw error;
}

export async function addGuide(noteId: string, guide: StudyGuide): Promise<SavedGuide> {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("study_guides")
    .insert({
      note_id: noteId,
      user_id: userId,
      guide,
    })
    .select("id, guide, created_at")
    .single();

  if (error) throw error;

  await supabase
    .from("notes")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", noteId)
    .eq("user_id", userId);

  const row = data as GuideRow;
  return {
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    guide: row.guide,
  };
}

export async function setTestDate(id: string, date: Date | null): Promise<void> {
  await updateNote(id, { testDate: date ? date.getTime() : null });
}
