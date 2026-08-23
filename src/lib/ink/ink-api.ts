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
}

interface InkRow {
  id: string;
  note_id: string;
  points: [number, number, number][];
  color: string;
  size: number;
  tool: InkTool;
}

const INK_SELECT = "id, note_id, points, color, size, tool";

function rowToStroke(row: InkRow): InkStroke {
  return {
    id: row.id,
    noteId: row.note_id,
    points: row.points ?? [],
    color: row.color,
    size: row.size,
    tool: row.tool,
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

export async function createStroke(
  noteId: string,
  stroke: Pick<InkStroke, "points" | "color" | "size" | "tool">,
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
