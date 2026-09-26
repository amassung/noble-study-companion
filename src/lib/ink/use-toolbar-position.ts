import { useCallback, useEffect, useRef, useState } from "react";

export interface ToolbarPos {
  x: number;
  y: number;
}

const STORAGE_KEY = "nobi:toolbarPos";
/** Keep this much of the palette on screen, so it can always be grabbed back. */
const KEEP_VISIBLE = 72;

function read(): ToolbarPos | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<ToolbarPos>;
    if (typeof v?.x !== "number" || typeof v?.y !== "number") return null;
    return { x: v.x, y: v.y };
  } catch {
    // Private browsing, cleared storage, or a value from an older shape.
    return null;
  }
}

/**
 * Keep a dragged palette on screen.
 *
 * Rotating an iPad, splitting the screen, or opening a note on a phone can all
 * leave a remembered position off the edge — and a palette that cannot be
 * reached cannot be moved back, which would strand the tools for good.
 */
function clamp(pos: ToolbarPos, width: number, height: number): ToolbarPos {
  const maxX = Math.max(0, window.innerWidth - KEEP_VISIBLE);
  const maxY = Math.max(0, window.innerHeight - height);
  return {
    x: Math.min(Math.max(pos.x, KEEP_VISIBLE - width), maxX),
    y: Math.min(Math.max(pos.y, 0), maxY),
  };
}

/**
 * Where the student has put the tool palette.
 *
 * Null means it has never been moved and sits in its default place. A
 * left-handed student, or anyone whose writing hand covers the top of the
 * page, needs to put the tools somewhere else — and needs them to still be
 * there tomorrow, so the position is remembered per device.
 */
export function useToolbarPosition() {
  const [pos, setPos] = useState<ToolbarPos | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);

  // Read after mount: localStorage does not exist during server rendering.
  useEffect(() => {
    setPos(read());
  }, []);

  const persist = useCallback((next: ToolbarPos | null) => {
    setPos(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Not being able to remember the position is not a reason to refuse to
      // move it now.
    }
  }, []);

  /** Begin a drag from the grip. */
  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      const el = elRef.current;
      if (!el) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      const { width, height } = rect;

      const move = (ev: PointerEvent) => {
        setPos(clamp({ x: ev.clientX - offsetX, y: ev.clientY - offsetY }, width, height));
      };
      const end = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        persist(clamp({ x: ev.clientX - offsetX, y: ev.clientY - offsetY }, width, height));
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
    [persist],
  );

  // A remembered spot can fall off screen when the window changes — on
  // rotation, on entering split view. Pull it back rather than lose it.
  useEffect(() => {
    if (!pos) return;
    const onResize = () => {
      const el = elRef.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      persist(clamp(pos, width, height));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [pos, persist]);

  return { pos, elRef, startDrag, reset: () => persist(null) };
}

export const __test = { clamp, KEEP_VISIBLE };
