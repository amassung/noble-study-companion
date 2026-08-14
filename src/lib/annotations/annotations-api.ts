import { getSupabaseClient } from "@/lib/supabase/client";
import { type Annotation, type AnnotationRow, type AnnotationType, rowToAnnotation } from "./types";

export async function fetchAnnotations(noteId: string): Promise<Annotation[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("annotations")
    .select("*")
    .eq("note_id", noteId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as AnnotationRow[]).map(rowToAnnotation);
}

export interface UpsertAnnotationInput {
  id?: string; // omit to create new
  noteId: string;
  slideKey: string;
  type: AnnotationType;
  data: Record<string, unknown>;
}

export async function upsertAnnotation(input: UpsertAnnotationInput): Promise<Annotation> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Not signed in");

  const row = {
    ...(input.id ? { id: input.id } : {}),
    note_id: input.noteId,
    user_id: user.id,
    slide_key: input.slideKey,
    type: input.type,
    data: input.data,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("annotations")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return rowToAnnotation(data as AnnotationRow);
}

export async function deleteAnnotation(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("annotations").delete().eq("id", id);
  if (error) throw error;
}
