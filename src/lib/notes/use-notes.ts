import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/auth-provider";
import type { StudyGuide } from "@/lib/study-guide.functions";
import {
  addGuide,
  createNote,
  deleteNote,
  fetchNotes,
  setTestDate,
  updateNote,
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
    mutationFn: createNote,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesQueryKey(user?.id) });
    },
  });
}

export function useUpdateNoteMutation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: NotePatch }) => updateNote(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notesQueryKey(user?.id) });
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
