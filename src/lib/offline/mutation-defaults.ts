import type { QueryClient } from "@tanstack/react-query";
import { updateNote, type NotePatch } from "@/lib/notes/notes-api";
import { updateBox, type BoxPatch } from "@/lib/boxes/boxes-api";
import {
  createStroke,
  deleteStrokes,
  updateStrokeGeometry,
  updateStrokeColor,
  type StrokeGeometry,
} from "@/lib/ink/ink-api";
import type { InkStroke } from "@/lib/ink/ink-api";
import { saveCardProgress } from "@/lib/cards/cards-api";
import type { CardProgress } from "@/lib/cards/cards";

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
  // Editing ink needs the same treatment as making it. Without these, an
  // erase or a move made in a basement lecture hall replayed only while the
  // app stayed open: reopen it and the write was stranded with no function to
  // run, so the erased stroke came back and the moved one snapped home.
  deleteStrokes: ["note_ink", "delete"] as const,
  updateStrokeGeometry: ["note_ink", "geometry"] as const,
  recolorStrokes: ["note_ink", "color"] as const,
  reviewCard: ["card_progress", "review"] as const,
};

export function registerOfflineMutationDefaults(queryClient: QueryClient) {
  // A key declared above but never registered here is the failure this whole
  // file exists to prevent, and it is invisible until someone edits offline
  // and reopens the app days later. Catch the drift at startup instead.
  const registered = new Set<string>();
  const define = queryClient.setMutationDefaults.bind(queryClient);
  queryClient.setMutationDefaults = ((key: readonly unknown[], options: unknown) => {
    registered.add(JSON.stringify(key));
    return define(key as never, options as never);
  }) as typeof queryClient.setMutationDefaults;
  queryClient.setMutationDefaults(OFFLINE_MUTATION_KEYS.updateNote, {
    mutationFn: ({ id, patch }: { id: string; patch: NotePatch }) => updateNote(id, patch),
  });

  queryClient.setMutationDefaults(OFFLINE_MUTATION_KEYS.updateBox, {
    mutationFn: ({ id, patch }: { id: string; patch: BoxPatch }) => updateBox(id, patch),
  });

  queryClient.setMutationDefaults(OFFLINE_MUTATION_KEYS.reviewCard, {
    mutationFn: (progress: CardProgress) => saveCardProgress(progress),
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

  queryClient.setMutationDefaults(OFFLINE_MUTATION_KEYS.deleteStrokes, {
    mutationFn: (ids: string[]) => deleteStrokes(ids),
  });

  queryClient.setMutationDefaults(OFFLINE_MUTATION_KEYS.updateStrokeGeometry, {
    mutationFn: (updates: StrokeGeometry[]) => updateStrokeGeometry(updates),
  });

  queryClient.setMutationDefaults(OFFLINE_MUTATION_KEYS.recolorStrokes, {
    mutationFn: ({ ids, color }: { ids: string[]; color: string }) => updateStrokeColor(ids, color),
  });

  queryClient.setMutationDefaults = define;
  if (import.meta.env.DEV) {
    const missing = Object.entries(OFFLINE_MUTATION_KEYS)
      .filter(([, key]) => !registered.has(JSON.stringify(key)))
      .map(([name]) => name);
    if (missing.length) {
      throw new Error(
        `Offline mutation keys declared but not registered: ${missing.join(", ")}. ` +
          "Writes made offline under these keys would never replay.",
      );
    }
  }
}
