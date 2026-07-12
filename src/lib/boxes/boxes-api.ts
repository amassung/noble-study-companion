import { getSupabaseClient } from "@/lib/supabase/client";

// A freeform text box on a note's page. x/width are fractions (0-1) of the
// page width; y is an absolute pixel offset from the page top.
export interface TextBox {
  id: string;
  noteId: string;
  x: number;
  y: number;
  width: number;
  content: string;
  fontSize: number;
}

interface BoxRow {
  id: string;
  note_id: string;
  x: number;
  y: number;
  width: number;
  content: string;
  font_size: number;
}

function rowToBox(row: BoxRow): TextBox {
  return {
    id: row.id,
    noteId: row.note_id,
    x: row.x,
    y: row.y,
    width: row.width,
    content: row.content,
    fontSize: row.font_size,
  };
}

const BOX_SELECT = "id, note_id, x, y, width, content, font_size";

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

export async function fetchBoxes(noteId: string): Promise<TextBox[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("note_boxes")
    .select(BOX_SELECT)
    .eq("note_id", noteId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as BoxRow[]).map(rowToBox);
}

export async function createBox(
  noteId: string,
  init: Partial<Pick<TextBox, "x" | "y" | "width" | "content" | "fontSize">> = {},
): Promise<TextBox> {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("note_boxes")
    .insert({
      note_id: noteId,
      user_id: userId,
      x: init.x ?? 0.1,
      y: init.y ?? 40,
      width: init.width ?? 0.4,
      content: init.content ?? "",
      font_size: init.fontSize ?? 16,
    })
    .select(BOX_SELECT)
    .single();
  if (error) throw error;
  return rowToBox(data as BoxRow);
}

export type BoxPatch = Partial<Pick<TextBox, "x" | "y" | "width" | "content" | "fontSize">>;

export async function updateBox(id: string, patch: BoxPatch): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.x !== undefined) row.x = patch.x;
  if (patch.y !== undefined) row.y = patch.y;
  if (patch.width !== undefined) row.width = patch.width;
  if (patch.content !== undefined) row.content = patch.content;
  if (patch.fontSize !== undefined) row.font_size = patch.fontSize;
  const { error } = await supabase
    .from("note_boxes")
    .update(row)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteBox(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  const { error } = await supabase.from("note_boxes").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}
