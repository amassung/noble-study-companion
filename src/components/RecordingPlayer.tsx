import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Loader2, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRecordings, useRecordingUrl } from "@/lib/audio/use-recordings";
import type { NoteRecording } from "@/lib/audio/audio-api";

const fmt = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(s).padStart(2, "0")}`;
};

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

/**
 * Play back a lecture recorded alongside this note.
 *
 * `seekRef` is handed out so the page can drive the playhead: tapping a word
 * written 12 minutes into the lecture jumps the audio to 12 minutes. That is
 * the whole point of stamping strokes — an hour of audio is unusable if the
 * only way in is scrubbing a bar.
 */
export function RecordingPlayer({
  noteId,
  seekRef,
  onTimeChange,
}: {
  noteId: string;
  /** Filled with seek(ms), so the page can jump the audio from a stroke. */
  seekRef?: { current: ((ms: number) => void) | null };
  /** Playhead position, for highlighting the ink written at this moment. */
  onTimeChange?: (ms: number | null) => void;
}) {
  const { data: recordings = [] } = useRecordings(noteId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const open: NoteRecording | undefined = useMemo(
    () => recordings.find((r) => r.id === openId) ?? recordings[0],
    [recordings, openId],
  );
  const { data: url, isLoading: urlLoading } = useRecordingUrl(open?.path ?? null);

  // Let the page seek us, and tell it where the playhead is.
  useEffect(() => {
    if (!seekRef) return;
    seekRef.current = (ms: number) => {
      const el = audioRef.current;
      if (!el) return;
      el.currentTime = Math.max(0, ms / 1000);
      void el.play().catch(() => undefined);
    };
    return () => {
      seekRef.current = null;
    };
  }, [seekRef, url]);

  useEffect(() => {
    onTimeChange?.(playing ? positionMs : null);
  }, [playing, positionMs, onTimeChange]);

  if (recordings.length === 0) return null;

  const duration = open?.durationMs ?? 0;

  return (
    <section className="mb-4 rounded-2xl border border-border/60 bg-[var(--surface-elevated)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
          <Headphones className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-[13px] font-semibold tracking-tight">
          Lecture audio
          {recordings.length > 1 && (
            <span className="ml-1.5 font-normal text-muted-foreground">
              {recordings.length} recordings
            </span>
          )}
        </h3>
      </div>

      {recordings.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {recordings.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setOpenId(r.id)}
              className={cn(
                "rounded-lg border px-2 py-1 text-[11.5px] font-medium transition-colors",
                r.id === open?.id
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {dayLabel(r.startedAt)}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          disabled={!url}
          aria-label={playing ? "Pause recording" : "Play recording"}
          onClick={() => {
            const el = audioRef.current;
            if (!el) return;
            if (playing) el.pause();
            else void el.play().catch(() => undefined);
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {urlLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 translate-x-[1px]" />
          )}
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(1, duration)}
          value={Math.min(positionMs, duration)}
          aria-label="Seek within the recording"
          onChange={(e) => {
            const ms = Number(e.target.value);
            setPositionMs(ms);
            if (audioRef.current) audioRef.current.currentTime = ms / 1000;
          }}
          className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-white/[0.12] accent-[var(--primary)]"
        />

        <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
          {fmt(positionMs)} / {fmt(duration)}
        </span>
      </div>

      <p className="mt-2 text-[11.5px] text-muted-foreground">
        Tap any handwriting written during this lecture to jump to that moment.
      </p>

      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setPositionMs(e.currentTarget.currentTime * 1000)}
        />
      )}
    </section>
  );
}
