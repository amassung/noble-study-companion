import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAnnotation,
  fetchAnnotations,
  upsertAnnotation,
  type UpsertAnnotationInput,
} from "./annotations-api";
import type { Annotation } from "./types";

function annotationsKey(noteId: string) {
  return ["annotations", noteId] as const;
}

export function useAnnotations(noteId: string) {
  return useQuery({
    queryKey: annotationsKey(noteId),
    queryFn: () => fetchAnnotations(noteId),
    staleTime: 60_000,
  });
}

export function useUpsertAnnotationMutation(noteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertAnnotationInput) => upsertAnnotation(input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: annotationsKey(noteId) });
      const prev = qc.getQueryData<Annotation[]>(annotationsKey(noteId)) ?? [];
      const optimistic: Annotation = {
        id: input.id ?? `optimistic-${Date.now()}`,
        noteId: input.noteId,
        slideKey: input.slideKey,
        type: input.type,
        data: input.data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as Annotation;
      const next = input.id
        ? prev.map((a) => (a.id === input.id ? optimistic : a))
        : [...prev, optimistic];
      qc.setQueryData(annotationsKey(noteId), next);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(annotationsKey(noteId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: annotationsKey(noteId) });
    },
  });
}

export function useDeleteAnnotationMutation(noteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAnnotation(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: annotationsKey(noteId) });
      const prev = qc.getQueryData<Annotation[]>(annotationsKey(noteId)) ?? [];
      qc.setQueryData(
        annotationsKey(noteId),
        prev.filter((a) => a.id !== id),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(annotationsKey(noteId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: annotationsKey(noteId) });
    },
  });
}
