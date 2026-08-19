import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-provider";
import { OFFLINE_MUTATION_KEYS } from "@/lib/offline/mutation-defaults";
import type { StudyGuide } from "@/lib/study-guide.functions";
import {
  addGuide,
  createNote,
  deleteGuide,
  deleteNote,
  fetchNotes,
  setTestDate,
  updateNote,
  type CreateNoteOpts,
  type NotePatch,
} from "./notes-api";
import type { SavedGuide, StoredNote } from "./types";

export function notesQueryKey(userId: string | undefined) {
  return ["notes", userId] as const;
}

export function useNotesList() {
  const { user } = useAuth();

  return useQuery({
    queryKey: notesQueryKey(user?.id),
    queryFn: fetchNotes,
    enabled: Boolean(user?.id),
  });
}

/** Notes array with empty default while loading. */
export function useNotes(): StoredNote[] {
  const { data } = useNotesList();
  return data ?? [];
}

export function useCreateNoteMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opts?: CreateNoteOpts) => createNote(opts),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesQueryKey(user?.id) });
    },
  });
}

export function useUpdateNoteMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    // Keyed so a save made offline can be replayed after an app restart
    // (see lib/offline/mutation-defaults.ts).
    mutationKey: OFFLINE_MUTATION_KEYS.updateNote,
    mutationFn: ({ id, patch }: { id: string; patch: NotePatch }) => updateNote(id, patch),
    // Patch the cached note immediately (not on success): autosave fires every
    // ~400ms while typing, so refetching every note body per save is needless
    // load — and, crucially, while offline the request never resolves. Writing
    // on success only would leave the persisted cache holding the *old* body,
    // so reopening the app offline would show the lecture's notes as missing
    // until the connection came back.
    onMutate: ({ id, patch }) => {
      const key = notesQueryKey(user?.id);
      const previous = queryClient.getQueryData<StoredNote[]>(key);
      if (!previous) return;
      const updatedAt = Date.now();
      queryClient.setQueryData<StoredNote[]>(
        key,
        previous
          .map((n) => (n.id === id ? { ...n, ...patch, updatedAt } : n))
          .sort((a, b) => b.updatedAt - a.updatedAt),
      );
      // Deliberately no rollback on error: the editor keeps showing the typed
      // text and retries, so discarding it from the cache would only make the
      // user's own words disappear from the list while they are still on screen.
    },
  });
}

export function useDeleteNoteMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteNote,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesQueryKey(user?.id) });
    },
  });
}

export function useAddGuideMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, guide }: { noteId: string; guide: StudyGuide }) =>
      addGuide(noteId, guide),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesQueryKey(user?.id) });
    },
  });
}

export function useDeleteGuideMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, guideId }: { noteId: string; guideId: string }) =>
      deleteGuide(noteId, guideId),
    onMutate: async ({ noteId, guideId }) => {
      const key = notesQueryKey(user?.id);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<StoredNote[]>(key);
      if (previous) {
        queryClient.setQueryData<StoredNote[]>(
          key,
          previous.map((n) =>
            n.id === noteId
              ? { ...n, guides: (n.guides ?? []).filter((g) => g.id !== guideId) }
              : n,
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(notesQueryKey(user?.id), context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notesQueryKey(user?.id) });
    },
  });
}

export function useSetTestDateMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: Date | null }) => setTestDate(id, date),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesQueryKey(user?.id) });
    },
  });
}

export type { SavedGuide, StoredNote };
