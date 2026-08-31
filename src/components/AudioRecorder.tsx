import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Pause, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  LectureRecorder,
  findOrphanedSessions,
  assembleSession,
  clearSession,
  type RecorderState,
  type RecordingSession,
} from "@/lib/audio/recorder";
import { saveRecording } from "@/lib/audio/audio-api";

const fmt = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
};

/**
 * Record a lecture alongside the note.
 *
 * The clock this exposes through `onElapsed` is what strokes are stamped
 * against, so a word written 12 minutes in can later seek the audio to 12
 * minutes in.
 */
export function AudioRecorder({
  noteId,
  onElapsedRef,
  onSaved,
}: {
  noteId: string;
  /** Filled with a getter for the current offset, or null when not recording. */
  onElapsedRef?: { current: (() => number | null) | null };
  onSaved?: () => void;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [orphan, setOrphan] = useState<RecordingSession | null>(null);
  const recorderRef = useRef<LectureRecorder | null>(null);

  if (!recorderRef.current) {
    recorderRef.current = new LectureRecorder({
      onTick: setElapsed,
      onStateChange: setState,
      onInterrupted: (reason) => {
        // Loud, and it stays until dismissed. Silently losing the rest of a
        // lecture is the failure this whole feature is built to avoid.
        toast.error(reason, { duration: Infinity, closeButton: true });
      },
    });
  }

  // Anything left behind by a session that never finished — a crash, a closed
  // tab, a flat battery — is offered back rather than quietly discarded.
  useEffect(() => {
    let cancelled = false;
    void findOrphanedSessions().then((found) => {
      if (cancelled) return;
      const mine = found.find((s) => s.noteId === noteId);
      if (mine) setOrphan(mine);
    });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  // Expose the recording clock to whoever stamps strokes.
  useEffect(() => {
    if (!onElapsedRef) return;
    onElapsedRef.current = () =>
      recorderRef.current && recorderRef.current.getState() !== "idle"
        ? recorderRef.current.elapsedMs()
        : null;
    return () => {
      onElapsedRef.current = null;
    };
  }, [onElapsedRef]);

  const store = useCallback(
    async (blob: Blob, durationMs: number, startedAt: number, sessionId: string) => {
      setSaving(true);
      try {
        await saveRecording({ noteId, blob, durationMs, startedAt });
        // Only now is the local copy redundant.
        await clearSession(sessionId);
        toast.success(`Recording saved — ${fmt(durationMs)}`);
        onSaved?.();
      } catch (e) {
        toast.error(
          e instanceof Error
            ? `Couldn't upload: ${e.message}. It's still on this device — try again.`
            : "Couldn't upload the recording. It's still on this device.",
          { duration: Infinity, closeButton: true },
        );
      } finally {
        setSaving(false);
      }
    },
    [noteId, onSaved],
  );

  const start = async () => {
    try {
      await recorderRef.current!.start(noteId);
      setElapsed(0);
    } catch (e) {
      toast.error(
        e instanceof Error && e.name === "NotAllowedError"
          ? "Microphone access was denied. Allow it in your browser settings to record."
          : e instanceof Error
            ? e.message
            : "Couldn't start recording.",
      );
    }
  };

  const stop = async () => {
    try {
      const { session, blob, durationMs } = await recorderRef.current!.stop();
      setElapsed(0);
      if (blob.size === 0) {
        toast.error("Nothing was captured — check the microphone.");
        return;
      }
      await store(blob, durationMs, session.startedAt, session.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't stop cleanly.");
    }
  };

  const recovering = state === "idle" && orphan;

  return (
    <div className="flex items-center gap-1.5">
      {recovering && (
        <button
          type="button"
          onClick={async () => {
            const blob = await assembleSession(orphan.id, orphan.mimeType);
            setOrphan(null);
            if (blob.size === 0) {
              await clearSession(orphan.id);
              toast.error("That recording had nothing in it.");
              return;
            }
            await store(blob, 0, orphan.startedAt, orphan.id);
          }}
          className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-2.5 py-1.5 text-[12px] font-medium text-amber-600 transition-colors hover:bg-amber-500/15"
          title="A recording from an interrupted session is still on this device"
        >
          Recover recording
        </button>
      )}

      {state === "idle" ? (
        <button
          type="button"
          onClick={start}
          disabled={saving}
          aria-label="Record lecture"
          title="Record the lecture alongside your notes"
          className="hover-glow flex items-center gap-1.5 rounded-lg border border-border/60 bg-[var(--surface)] px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-500 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">{saving ? "Saving…" : "Record"}</span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5 rounded-lg border border-red-500/50 bg-red-500/10 px-2 py-1">
          <span
            className={cn(
              "h-2 w-2 rounded-full bg-red-500",
              state === "recording" && "animate-pulse",
            )}
            aria-hidden
          />
          <span className="min-w-[46px] text-[12px] font-medium tabular-nums text-red-500">
            {fmt(elapsed)}
          </span>
          {state === "recording" ? (
            <button
              type="button"
              onClick={() => recorderRef.current!.pause()}
              aria-label="Pause recording"
              title="Pause"
              className="flex h-6 w-6 items-center justify-center rounded text-red-500 hover:bg-red-500/15"
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => recorderRef.current!.resume()}
              aria-label="Resume recording"
              title="Resume"
              className="flex h-6 w-6 items-center justify-center rounded text-red-500 hover:bg-red-500/15"
            >
              <Play className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={stop}
            aria-label="Stop recording"
            title="Stop and save"
            className="flex h-6 w-6 items-center justify-center rounded text-red-500 hover:bg-red-500/15"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
