import { getSupabaseClient } from "@/lib/supabase/client";

// Kept in sync with the note_ink.tool CHECK constraint
// (supabase/migrations/20260823000000_ink_tools.sql).
export type InkTool = "pen" | "pencil" | "fineliner" | "highlighter";

// A single freehand stroke on a note page. Points are [x, y, pressure] where
// x is a 0-1 fraction of page width and y is absolute px from the page top.
export interface InkStroke {
  id: string;
  noteId: string;
  points: [number, number, number][];
  color: string;
  size: number;
  tool: InkTool;
  /**
   * Milliseconds into the recording this stroke was drawn, or null when it was
   * written with nothing recording. This is what lets a word seek the audio to
   * the moment it was written.
   */
  tMs?: number | null;
  /** The recording it belongs to. Attached once that recording is saved. */
  audioId?: string | null;
}

interface InkRow {
  id: string;
  note_id: string;
  points: [number, number, number][];
  color: string;
  size: number;
  tool: InkTool;
  t_ms: number | null;
  audio_id: string | null;
}

const INK_SELECT = "id, note_id, points, color, size, tool, t_ms, audio_id";

function rowToStroke(row: InkRow): InkStroke {
  return {
    id: row.id,
    noteId: row.note_id,
    points: row.points ?? [],
    color: row.color,
    size: row.size,
    tool: row.tool,
    tMs: row.t_ms,
    audioId: row.audio_id,
  };
}

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

export async function fetchInk(noteId: string): Promise<InkStroke[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("note_ink")
    .select(INK_SELECT)
    .eq("note_id", noteId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as InkRow[]).map(rowToStroke);
}

/**
 * Ink for many notes at once, keyed by note id.
 *
 * The notes list draws a real thumbnail of every note, and calling fetchInk
 * per row would fire one request per note on a screen that routinely shows
 * dozens. Only the fields a thumbnail needs are selected, and strokes are
 * capped per note so one heavily-annotated lecture cannot dominate the
 * payload — a preview a few hundred pixels wide cannot show the difference.
 */
export async function fetchInkForNotes(noteIds: string[]): Promise<Record<string, InkStroke[]>> {
  if (!noteIds.length) return {};
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("note_ink")
    .select(INK_SELECT)
    .in("note_id", noteIds)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const MAX_PER_NOTE = 400;
  const byNote: Record<string, InkStroke[]> = {};
  for (const row of data as InkRow[]) {
    const list = (byNote[row.note_id] ??= []);
    if (list.length < MAX_PER_NOTE) list.push(rowToStroke(row));
  }
  return byNote;
}

export async function createStroke(
  noteId: string,
  stroke: Pick<InkStroke, "points" | "color" | "size" | "tool"> & { tMs?: number | null },
): Promise<InkStroke> {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("note_ink")
    .insert({
      note_id: noteId,
      user_id: userId,
      points: stroke.points,
      color: stroke.color,
      size: stroke.size,
      tool: stroke.tool,
      t_ms: stroke.tMs ?? null,
    })
    .select(INK_SELECT)
    .single();
  if (error) throw error;
  return rowToStroke(data as InkRow);
}

export async function deleteStrokes(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  const { error } = await supabase.from("note_ink").delete().in("id", ids).eq("user_id", userId);
  if (error) throw error;
}

/** A moved or resized stroke: new geometry for an existing row. */
export interface StrokeGeometry {
  id: string;
  points: [number, number, number][];
  size: number;
}

/**
 * Rewrite the geometry of strokes that were dragged or scaled.
 *
 * Requires the note_ink UPDATE policy added in 20260823010000 — without it
 * RLS matches zero rows and reports no error, so the move silently reverts.
 */
export async function updateStrokeGeometry(updates: StrokeGeometry[]): Promise<void> {
  if (!updates.length) return;
  const supabase = getSupabaseClient();
  const results = await Promise.all(
    updates.map((u) =>
      supabase
        .from("note_ink")
        .update({ points: u.points, size: u.size })
        .eq("id", u.id)
        .select("id"),
    ),
  );
  for (const { error, data } of results) {
    if (error) throw error;
    // Zero rows back means the policy rejected it rather than the row being
    // missing; surface that instead of pretending the move was saved.
    if (!data || data.length === 0) throw new Error("Stroke update affected no rows");
  }
}

/**
 * Recolour existing strokes.
 *
 * Separate from updateStrokeGeometry because the two are different edits with
 * different failure messages: one is "your move didn't save", the other is
 * "your colour change didn't save", and a student should be told which.
 */
export async function updateStrokeColor(ids: string[], color: string): Promise<void> {
  if (!ids.length) return;
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("note_ink")
    .update({ color })
    .in("id", ids)
    .eq("user_id", userId)
    .select("id");
  if (error) throw error;
  // Zero rows back means RLS rejected it rather than the rows being missing;
  // surface that instead of pretending the recolour was saved.
  if (!data || data.length === 0) throw new Error("Stroke recolour affected no rows");
}

/**
 * Attach strokes written during a recording to that recording.
 *
 * Strokes are stamped with an offset as they are drawn, but the recording has
 * no id until it is saved — so the link is made afterwards, over everything on
 * this note that carries an offset and is not yet claimed.
 */
export async function linkStrokesToRecording(noteId: string, audioId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("note_ink")
    .update({ audio_id: audioId })
    .eq("note_id", noteId)
    .is("audio_id", null)
    .not("t_ms", "is", null);
  if (error) throw error;
}
