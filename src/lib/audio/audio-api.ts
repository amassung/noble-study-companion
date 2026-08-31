import { getSupabaseClient } from "@/lib/supabase/client";

const BUCKET = "recordings";

export interface NoteRecording {
  id: string;
  noteId: string;
  path: string;
  durationMs: number;
  startedAt: string;
}

interface AudioRow {
  id: string;
  note_id: string;
  path: string;
  duration_ms: number;
  started_at: string;
}

const SELECT = "id, note_id, path, duration_ms, started_at";

const rowToRecording = (r: AudioRow): NoteRecording => ({
  id: r.id,
  noteId: r.note_id,
  path: r.path,
  durationMs: r.duration_ms,
  startedAt: r.started_at,
});

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

export async function fetchRecordings(noteId: string): Promise<NoteRecording[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("note_audio")
    .select(SELECT)
    .eq("note_id", noteId)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return (data as AudioRow[]).map(rowToRecording);
}

const extensionFor = (mimeType: string) => {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("aac")) return "aac";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
};

/**
 * Store a finished recording.
 *
 * Uploads before inserting the row, so a row never points at a file that is
 * not there. The caller keeps its local copy until this resolves — a failed
 * upload must not be what loses the lecture.
 */
export async function saveRecording({
  noteId,
  blob,
  durationMs,
  startedAt,
}: {
  noteId: string;
  blob: Blob;
  durationMs: number;
  startedAt: number;
}): Promise<NoteRecording> {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  const ext = extensionFor(blob.type || "audio/webm");
  const path = `${userId}/${noteId}/${startedAt}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || "audio/webm", upsert: true });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("note_audio")
    .insert({
      note_id: noteId,
      user_id: userId,
      path,
      duration_ms: Math.round(durationMs),
      started_at: new Date(startedAt).toISOString(),
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return rowToRecording(data as AudioRow);
}

/**
 * A time-limited URL for playback. The bucket is private because a lecture
 * recording carries other people's voices, so this cannot be a public URL.
 */
export async function recordingUrl(path: string, expiresInSeconds = 60 * 60): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteRecording(rec: NoteRecording): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.storage.from(BUCKET).remove([rec.path]);
  const { error } = await supabase.from("note_audio").delete().eq("id", rec.id);
  if (error) throw error;
}
