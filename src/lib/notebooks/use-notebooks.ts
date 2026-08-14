import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  createNotebook,
  deleteNotebook,
  fetchNotebooks,
  updateNotebook,
  type CreateNotebookOpts,
  type NotebookPatch,
} from "./notebooks-api";
import type { StoredNotebook } from "./types";

export function notebooksQueryKey(userId: string | undefined) {
  return ["notebooks", userId] as const;
}

export function useNotebooksList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: notebooksQueryKey(user?.id),
    queryFn: fetchNotebooks,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
}

export function useNotebooks(): StoredNotebook[] {
  const { data } = useNotebooksList();
  return data ?? [];
}

export function useCreateNotebookMutation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: CreateNotebookOpts) => createNotebook(opts),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notebooksQueryKey(user?.id) });
    },
  });
}

export function useUpdateNotebookMutation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: NotebookPatch }) => updateNotebook(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notebooksQueryKey(user?.id) });
    },
  });
}

export function useDeleteNotebookMutation() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteNotebook,
    onMutate: async (id) => {
      const key = notebooksQueryKey(user?.id);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<StoredNotebook[]>(key);
      qc.setQueryData<StoredNotebook[]>(
        key,
        (prev ?? []).filter((n) => n.id !== id),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(notebooksQueryKey(user?.id), ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: notebooksQueryKey(user?.id) });
    },
  });
}
