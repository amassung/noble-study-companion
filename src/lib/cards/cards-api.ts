import { getSupabaseClient } from "@/lib/supabase/client";
import type { CardProgress } from "./cards";

interface ProgressRow {
  note_id: string;
  card_key: string;
  ease: number;
  interval_days: number;
  reps: number;
  lapses: number;
  due_at: string;
}

const SELECT = "note_id, card_key, ease, interval_days, reps, lapses, due_at";

function rowToProgress(row: ProgressRow): CardProgress {
  return {
    cardKey: row.card_key,
    noteId: row.note_id,
    ease: row.ease,
    intervalDays: row.interval_days,
    reps: row.reps,
    lapses: row.lapses,
    dueAt: new Date(row.due_at).getTime(),
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

export async function fetchCardProgress(): Promise<CardProgress[]> {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  const { data, error } = await supabase.from("card_progress").select(SELECT).eq("user_id", userId);
  if (error) throw error;
  return (data as ProgressRow[]).map(rowToProgress);
}

/**
 * Upsert one card's scheduling state. Keyed on (user, note, card) so repeated
 * reviews update in place rather than accumulating rows.
 */
export async function saveCardProgress(progress: CardProgress): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await requireUserId();
  const { error } = await supabase.from("card_progress").upsert(
    {
      user_id: userId,
      note_id: progress.noteId,
      card_key: progress.cardKey,
      ease: progress.ease,
      interval_days: progress.intervalDays,
      reps: progress.reps,
      lapses: progress.lapses,
      due_at: new Date(progress.dueAt).toISOString(),
      updated_at: new Date().toISOString(),
      last_reviewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,note_id,card_key" },
  );
  if (error) throw error;
}
