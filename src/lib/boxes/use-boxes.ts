import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type BoxPatch,
  type TextBox,
  createBox,
  deleteBox,
  fetchBoxes,
  updateBox,
} from "./boxes-api";

function boxesKey(noteId: string) {
  return ["note_boxes", noteId] as const;
}

export function useBoxes(noteId: string) {
  return useQuery({
    queryKey: boxesKey(noteId),
    queryFn: () => fetchBoxes(noteId),
    staleTime: 60_000,
  });
}

export function useCreateBoxMutation(noteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (init?: Parameters<typeof createBox>[1]) => createBox(noteId, init),
    onSuccess: (box) => {
      qc.setQueryData<TextBox[]>(boxesKey(noteId), (prev) => [...(prev ?? []), box]);
    },
  });
}

export function useUpdateBoxMutation(noteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: BoxPatch }) => updateBox(id, patch),
    // Optimistic: drag/resize/typing must feel instant.
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: boxesKey(noteId) });
      const prev = qc.getQueryData<TextBox[]>(boxesKey(noteId));
      qc.setQueryData<TextBox[]>(boxesKey(noteId), (cur) =>
        (cur ?? []).map((b) => (b.id === id ? { ...b, ...patch } : b)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(boxesKey(noteId), ctx.prev);
    },
  });
}

export function useDeleteBoxMutation(noteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBox(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: boxesKey(noteId) });
      const prev = qc.getQueryData<TextBox[]>(boxesKey(noteId));
      qc.setQueryData<TextBox[]>(boxesKey(noteId), (cur) => (cur ?? []).filter((b) => b.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(boxesKey(noteId), ctx.prev);
    },
  });
}
