import { getSupabaseClient } from "@/lib/supabase/client";
import {
  type NotebookColor,
  type NotebookRow,
  type StoredNotebook,
  rowToStoredNotebook,
} from "./types";

export async function fetchNotebooks(): Promise<StoredNotebook[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("notebooks")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as NotebookRow[]).map(rowToStoredNotebook);
}

export interface CreateNotebookOpts {
  name: string;
  emoji?: string;
  color?: NotebookColor;
  sortOrder?: number;
}

export async function createNotebook(opts: CreateNotebookOpts): Promise<StoredNotebook> {
  const supabase = getSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("notebooks")
    .insert({
      user_id:    user.id,
      name:       opts.name,
      emoji:      opts.emoji      ?? "📓",
      color:      opts.color      ?? "violet",
      sort_order: opts.sortOrder  ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToStoredNotebook(data as NotebookRow);
}

export type NotebookPatch = Partial<Pick<StoredNotebook, "name" | "emoji" | "color" | "sortOrder">>;

export async function updateNotebook(id: string, patch: NotebookPatch): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Not signed in");

  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name       !== undefined) row.name       = patch.name;
  if (patch.emoji      !== undefined) row.emoji      = patch.emoji;
  if (patch.color      !== undefined) row.color      = patch.color;
  if (patch.sortOrder  !== undefined) row.sort_order = patch.sortOrder;

  const { error } = await supabase
    .from("notebooks")
    .update(row)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}

export async function deleteNotebook(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("notebooks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}
