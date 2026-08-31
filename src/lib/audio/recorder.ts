import { get, set, del, keys } from "idb-keyval";

/**
 * Lecture recorder.
 *
 * The governing rule here is that a recording must survive everything except
 * the device being destroyed. A student records one 90-minute lecture that
 * cannot be repeated; losing it is not a bug they forgive, it is the reason
 * they stop using the app. So nothing is held only in memory: MediaRecorder is
 * run with a timeslice and every chunk is written to IndexedDB the moment it
 * arrives. A crash, a reload, a killed tab or a flat battery costs at most one
 * chunk, and whatever reached disk can still be recovered on next launch.
 *
 * Known limit, and it is a real one: this records through the browser. On iOS
 * a web view stops capturing when the screen locks or the app goes to the
 * background — a native app like Notability does not. A screen wake lock is
 * taken while recording to stop the display sleeping on its own, and an
 * interruption is reported loudly rather than swallowed, but a student who
 * switches apps mid-lecture will lose the rest of it. Recording in the
 * background needs the native layer, not this file.
 */

const CHUNK_MS = 5_000;
const KEY_PREFIX = "nobi:rec:";

export type RecorderState = "idle" | "recording" | "paused" | "stopping";

export interface RecordingSession {
  id: string;
  noteId: string;
  startedAt: number;
  mimeType: string;
}

interface ChunkKeyParts {
  sessionId: string;
  index: number;
}

const chunkKey = ({ sessionId, index }: ChunkKeyParts) =>
  `${KEY_PREFIX}${sessionId}:${String(index).padStart(6, "0")}`;
const metaKey = (sessionId: string) => `${KEY_PREFIX}${sessionId}:meta`;

/** The recorder picks whichever container the browser will actually give it. */
function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    // Safari, which does not do webm.
    "audio/mp4",
    "audio/aac",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export interface RecorderEvents {
  onTick?: (elapsedMs: number) => void;
  /** Capture stopped for a reason the student did not ask for. */
  onInterrupted?: (reason: string) => void;
  onStateChange?: (state: RecorderState) => void;
}

export class LectureRecorder {
  private media: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private session: RecordingSession | null = null;
  private chunkIndex = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  /** Time already banked from previous run segments, for pause/resume. */
  private bankedMs = 0;
  private segmentStart = 0;
  private state: RecorderState = "idle";

  constructor(private events: RecorderEvents = {}) {}

  getState() {
    return this.state;
  }

  /** Milliseconds of audio captured so far — the clock strokes are stamped against. */
  elapsedMs(): number {
    if (this.state === "recording") return this.bankedMs + (Date.now() - this.segmentStart);
    return this.bankedMs;
  }

  getSession() {
    return this.session;
  }

  private setState(next: RecorderState) {
    this.state = next;
    this.events.onStateChange?.(next);
  }

  async start(noteId: string): Promise<RecordingSession> {
    if (this.state !== "idle") throw new Error("Already recording.");
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser can't record audio.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.stream = stream;

    const mimeType = pickMimeType();
    const media = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    this.media = media;

    const session: RecordingSession = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      noteId,
      startedAt: Date.now(),
      mimeType: media.mimeType || mimeType || "audio/webm",
    };
    this.session = session;
    this.chunkIndex = 0;
    this.bankedMs = 0;
    await set(metaKey(session.id), session);

    media.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;
      // Straight to disk. Deliberately not awaited: dropping a frame of UI is
      // preferable to blocking the recorder's own callback.
      void set(chunkKey({ sessionId: session.id, index: this.chunkIndex++ }), e.data);
    };
    media.onerror = () => {
      this.events.onInterrupted?.("The recorder stopped unexpectedly.");
    };

    media.start(CHUNK_MS);
    this.segmentStart = Date.now();
    this.setState("recording");

    // Stop the screen sleeping, which on iOS would end capture outright.
    await this.acquireWakeLock();
    this.watchInterruptions();

    this.tickTimer = setInterval(() => this.events.onTick?.(this.elapsedMs()), 250);
    return session;
  }

  private async acquireWakeLock() {
    try {
      const wl = (navigator as Navigator & { wakeLock?: WakeLock }).wakeLock;
      if (!wl) return;
      this.wakeLock = await wl.request("screen");
    } catch {
      /* refused or unsupported — recording continues, the screen may sleep */
    }
  }

  private releaseWakeLock() {
    void this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
  }

  private onVisibility = () => {
    if (document.visibilityState === "visible") {
      // The lock is dropped by the system on hide; take it again.
      if (this.state === "recording") void this.acquireWakeLock();
      return;
    }
    if (this.state === "recording") {
      this.events.onInterrupted?.(
        "Nobi can't record while it's in the background. Everything up to now is saved.",
      );
    }
  };

  private watchInterruptions() {
    document.addEventListener("visibilitychange", this.onVisibility);
    // A track ending means the mic was taken — a call, another app, unplugged
    // headphones. Say so rather than appearing to record silence.
    this.stream?.getAudioTracks().forEach((t) => {
      t.onended = () => this.events.onInterrupted?.("The microphone was disconnected.");
    });
  }

  private unwatchInterruptions() {
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  pause() {
    if (this.state !== "recording" || !this.media) return;
    this.media.pause();
    this.bankedMs += Date.now() - this.segmentStart;
    this.setState("paused");
  }

  resume() {
    if (this.state !== "paused" || !this.media) return;
    this.media.resume();
    this.segmentStart = Date.now();
    this.setState("recording");
  }

  /**
   * Stop and return the finished audio. The chunks stay on disk until the
   * caller has stored the result and calls discard(): a failed upload must not
   * be the thing that loses the lecture.
   */
  async stop(): Promise<{ session: RecordingSession; blob: Blob; durationMs: number }> {
    if (!this.media || !this.session) throw new Error("Not recording.");
    // Read this before the state changes: setState("stopping") would make the
    // paused check below impossible to satisfy, banking time that was never
    // recorded and leaving the duration longer than the audio.
    const wasPaused = this.state === "paused";
    this.setState("stopping");
    if (!wasPaused) this.bankedMs += Date.now() - this.segmentStart;
    const session = this.session;
    const durationMs = this.bankedMs;

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      this.media!.addEventListener("stop", done, { once: true });
      try {
        this.media!.stop();
      } catch {
        resolve();
      }
    });

    this.stream?.getTracks().forEach((t) => t.stop());
    this.releaseWakeLock();
    this.unwatchInterruptions();
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.media = null;
    this.stream = null;
    this.session = null;
    this.setState("idle");

    const blob = await assembleSession(session.id, session.mimeType);
    return { session, blob, durationMs };
  }

  /** Called once the recording is safely stored elsewhere. */
  async discard(sessionId: string) {
    await clearSession(sessionId);
  }
}

/** Stitch a session's chunks back into one blob, in order. */
export async function assembleSession(sessionId: string, mimeType: string): Promise<Blob> {
  const all = await keys();
  const mine = all
    .filter((k): k is string => typeof k === "string" && k.startsWith(`${KEY_PREFIX}${sessionId}:`))
    .filter((k) => !k.endsWith(":meta"))
    .sort();
  const parts: BlobPart[] = [];
  for (const k of mine) {
    const chunk = await get<Blob>(k);
    if (chunk) parts.push(chunk);
  }
  return new Blob(parts, { type: mimeType });
}

export async function clearSession(sessionId: string) {
  const all = await keys();
  const mine = all.filter(
    (k): k is string => typeof k === "string" && k.startsWith(`${KEY_PREFIX}${sessionId}:`),
  );
  await Promise.all(mine.map((k) => del(k)));
}

/**
 * Recordings left on disk by a session that never finished — a crash, a closed
 * tab, a dead battery. Surfaced on launch so the student can recover a lecture
 * the app would otherwise have quietly lost.
 */
export async function findOrphanedSessions(): Promise<RecordingSession[]> {
  const all = await keys();
  const metas = all.filter(
    (k): k is string => typeof k === "string" && k.startsWith(KEY_PREFIX) && k.endsWith(":meta"),
  );
  const out: RecordingSession[] = [];
  for (const k of metas) {
    const meta = await get<RecordingSession>(k);
    if (!meta) continue;
    // A meta with no chunks is an empty start; nothing to recover.
    const hasAudio = all.some(
      (c) =>
        typeof c === "string" && c.startsWith(`${KEY_PREFIX}${meta.id}:`) && !c.endsWith(":meta"),
    );
    if (hasAudio) out.push(meta);
  }
  return out.sort((a, b) => b.startedAt - a.startedAt);
}
