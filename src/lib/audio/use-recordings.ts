import { useQuery } from "@tanstack/react-query";
import { fetchRecordings, recordingUrl } from "@/lib/audio/audio-api";

export const recordingsKey = (noteId: string) => ["note_audio", noteId] as const;

export function useRecordings(noteId: string) {
  return useQuery({
    queryKey: recordingsKey(noteId),
    queryFn: () => fetchRecordings(noteId),
    staleTime: 30_000,
  });
}

/**
 * A playable URL for one recording.
 *
 * The bucket is private, so playback needs a signed URL. It is fetched lazily —
 * only when a recording is actually opened — because signing every recording on
 * a note would issue links nobody listens to, and each one expires.
 */
export function useRecordingUrl(path: string | null) {
  return useQuery({
    queryKey: ["note_audio_url", path],
    queryFn: () => recordingUrl(path!),
    enabled: !!path,
    // Comfortably inside the signed URL's own hour, so a link never expires
    // mid-playback and leave the player silently dead.
    staleTime: 45 * 60 * 1000,
  });
}
