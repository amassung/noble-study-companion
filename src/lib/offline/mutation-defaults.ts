import type { QueryClient } from "@tanstack/react-query";
import { updateNote, type NotePatch } from "@/lib/notes/notes-api";
import { updateBox, type BoxPatch } from "@/lib/boxes/boxes-api";
import { createStroke } from "@/lib/ink/ink-api";
import type { InkStroke } from "@/lib/ink/ink-api";

/**
 * Stable mutation keys. A paused (offline) mutation is persisted by key only —
 * its function cannot be serialised — so the same key must be registered with
 * a mutationFn at startup for the write to replay after the app is reopened.
 *
 * Without this, edits made offline would sit in the restored cache forever
 * while the UI showed them as applied, and the next successful refetch would
 * replace them with the older server copy: silent loss of a lecture's notes.
 */
export const OFFLINE_MUTATION_KEYS = {
  updateNote: ["notes", "update"] as const,
  updateBox: ["note_boxes", "update"] as const,
  createStroke: ["note_ink", "create"] as const,
};

export function registerOfflineMutationDefaults(queryClient: QueryClient) {
  queryClient.setMutationDefaults(OFFLINE_MUTATION_KEYS.updateNote, {
    mutationFn: ({ id, patch }: { id: string; patch: NotePatch }) => updateNote(id, patch),
  });

  queryClient.setMutationDefaults(OFFLINE_MUTATION_KEYS.updateBox, {
    mutationFn: ({ id, patch }: { id: string; patch: BoxPatch }) => updateBox(id, patch),
  });

  queryClient.setMutationDefaults(OFFLINE_MUTATION_KEYS.createStroke, {
    mutationFn: ({
      noteId,
      stroke,
    }: {
      noteId: string;
      stroke: Pick<InkStroke, "points" | "color" | "size" | "tool">;
    }) => createStroke(noteId, stroke),
  });
}
