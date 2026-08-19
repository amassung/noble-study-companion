import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { OFFLINE_MUTATION_KEYS } from "@/lib/offline/mutation-defaults";
import { type InkStroke, createStroke, deleteStrokes, fetchInk } from "./ink-api";

function inkKey(noteId: string) {
  return ["note_ink", noteId] as const;
}

// Optimistic strokes carry a temporary id until the insert returns.
export function isTempStrokeId(id: string) {
  return id.startsWith("temp-");
}

export function useInk(noteId: string) {
  return useQuery({
    queryKey: inkKey(noteId),
    queryFn: () => fetchInk(noteId),
    staleTime: 60_000,
  });
}

export function useCreateStrokeMutation(noteId: string) {
  const qc = useQueryClient();
  return useMutation({
    // Keyed, and noteId travels in the variables rather than a closure, so a
    // stroke drawn offline can be replayed after an app restart.
    mutationKey: OFFLINE_MUTATION_KEYS.createStroke,
    mutationFn: ({
      noteId: id,
      stroke,
    }: {
      noteId: string;
      stroke: Parameters<typeof createStroke>[1];
    }) => createStroke(id, stroke),
    // Optimistic: the stroke must appear the instant the pen lifts.
    onMutate: async ({ stroke }) => {
      await qc.cancelQueries({ queryKey: inkKey(noteId) });
      const prev = qc.getQueryData<InkStroke[]>(inkKey(noteId));
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      qc.setQueryData<InkStroke[]>(inkKey(noteId), (cur) => [
        ...(cur ?? []),
        { id: tempId, noteId, ...stroke },
      ]);
      return { prev, tempId };
    },
    onSuccess: (saved, _vars, ctx) => {
      // Swap the optimistic stroke for the persisted one (keeps its id real
      // so the eraser can delete it).
      qc.setQueryData<InkStroke[]>(inkKey(noteId), (cur) =>
        (cur ?? []).map((s) => (s.id === ctx?.tempId ? saved : s)),
      );
    },
    // Roll back even when there was no prior data (`prev` undefined) — the
    // old `if (ctx?.prev)` guard skipped the rollback in exactly that case,
    // leaving a phantom stroke on screen that looked saved but vanished on
    // reload. Tell the user instead of losing handwriting silently.
    onError: (_e, _v, ctx) => {
      qc.setQueryData<InkStroke[]>(inkKey(noteId), ctx?.prev ?? []);
      toast.error("Couldn't save that stroke — check your connection.");
    },
  });
}

export function useDeleteStrokesMutation(noteId: string) {
  const qc = useQueryClient();
  return useMutation({
    // Strokes still holding a temporary id were never persisted, so there is
    // nothing to delete server-side — drop them locally only.
    mutationFn: (ids: string[]) => deleteStrokes(ids.filter((id) => !isTempStrokeId(id))),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: inkKey(noteId) });
      const prev = qc.getQueryData<InkStroke[]>(inkKey(noteId));
      qc.setQueryData<InkStroke[]>(inkKey(noteId), (cur) =>
        (cur ?? []).filter((s) => !ids.includes(s.id)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData<InkStroke[]>(inkKey(noteId), ctx?.prev ?? []);
      toast.error("Couldn't erase — check your connection.");
    },
  });
}
