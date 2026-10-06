import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_DOCK,
  nearestEdge,
  readDock,
  writeDock,
  type DockEdge,
  type DockState,
} from "./toolbar-dock";

/**
 * Which edge the tool palette is parked on, and whether it is collapsed.
 *
 * Dragging snaps to the nearest edge rather than leaving the palette wherever
 * the finger stopped: free positioning sounds more flexible and is worse — a
 * palette in the middle of the page covers the writing, and one nudged half
 * off-screen is awkward to get back. An edge is always out of the way and
 * always findable.
 *
 * Remembered per device, because where a palette should live depends on which
 * hand someone writes with, and that does not change between sessions.
 */
export function useToolbarDock() {
  const [dock, setDock] = useState<DockState>(DEFAULT_DOCK);
  const elRef = useRef<HTMLDivElement | null>(null);

  // Read after mount: localStorage does not exist during server rendering.
  useEffect(() => {
    setDock(readDock());
  }, []);

  const update = useCallback((next: DockState) => {
    setDock(next);
    writeDock(next);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setDock((d) => {
      const next = { ...d, collapsed: !d.collapsed };
      writeDock(next);
      return next;
    });
  }, []);

  /**
   * Drag the palette to another edge.
   *
   * The edge is decided from where the finger finishes, not from where the
   * palette ends up, so a short deliberate flick toward an edge works without
   * having to haul the whole palette across the screen.
   */
  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      let last: DockEdge = dock.edge;

      const move = (ev: PointerEvent) => {
        last = nearestEdge(ev.clientX, ev.clientY, window.innerWidth, window.innerHeight);
      };
      const end = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        const edge = nearestEdge(ev.clientX, ev.clientY, window.innerWidth, window.innerHeight);
        update({ edge: edge ?? last, collapsed: false });
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    },
    [dock.edge, update],
  );

  return {
    edge: dock.edge,
    collapsed: dock.collapsed,
    elRef,
    startDrag,
    toggleCollapsed,
  };
}
