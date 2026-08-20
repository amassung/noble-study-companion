import { useCallback, useRef, useState } from "react";
import type { InkStroke } from "./ink-api";
import { useCreateStrokeMutation, useDeleteStrokesMutation, useInk } from "./use-ink";

type StrokeInput = Pick<InkStroke, "points" | "color" | "size" | "tool">;

/**
 * One reversible ink edit. `strokes` holds the affected strokes so undo can
 * either remove them (an add) or put them back (an erase).
 */
type Op = { type: "add"; strokes: InkStroke[] } | { type: "erase"; strokes: InkStroke[] };

/**
 * Ink editing with undo/redo.
 *
 * Handwriting without undo is unusable — a bad stroke should cost one tap,
 * not a switch to the eraser. Both the canvas and the toolbar need the same
 * history, so all ink mutations funnel through here.
 *
 * History is per-session (like GoodNotes): it is not persisted, so reopening
 * a note starts a fresh stack rather than letting someone undo work from days
 * ago that has long since synced.
 */
export function useInkHistory(noteId: string) {
  const { data: strokes = [] } = useInk(noteId);
  const createStroke = useCreateStrokeMutation(noteId);
  const deleteStrokes = useDeleteStrokesMutation(noteId);

  // Refs drive the actual work (stable across renders); state mirrors depth so
  // the toolbar can enable/disable its buttons.
  const undoRef = useRef<Op[]>([]);
  const redoRef = useRef<Op[]>([]);
  const [depths, setDepths] = useState({ undo: 0, redo: 0 });
  const sync = () => setDepths({ undo: undoRef.current.length, redo: redoRef.current.length });

  /** Record a completed stroke, clearing any redo branch. */
  const recordAdd = useCallback((stroke: InkStroke) => {
    undoRef.current.push({ type: "add", strokes: [stroke] });
    redoRef.current = [];
    sync();
  }, []);

  const addStroke = useCallback(
    (stroke: StrokeInput) => {
      createStroke.mutate(
        { noteId, stroke },
        {
          // Record the *saved* stroke: undo needs the real id to delete it.
          onSuccess: (saved) => recordAdd(saved),
        },
      );
    },
    [createStroke, noteId, recordAdd],
  );

  const eraseStrokes = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const erased = strokes.filter((s) => ids.includes(s.id));
      if (erased.length === 0) return;
      deleteStrokes.mutate(ids);
      undoRef.current.push({ type: "erase", strokes: erased });
      redoRef.current = [];
      sync();
    },
    [deleteStrokes, strokes],
  );

  /** Re-create strokes, returning them with their new server ids. */
  const restore = useCallback(
    async (toRestore: InkStroke[]): Promise<InkStroke[]> => {
      const restored: InkStroke[] = [];
      for (const s of toRestore) {
        const saved = await createStroke.mutateAsync({
          noteId,
          stroke: { points: s.points, color: s.color, size: s.size, tool: s.tool },
        });
        restored.push(saved);
      }
      return restored;
    },
    [createStroke, noteId],
  );

  const undo = useCallback(async () => {
    const op = undoRef.current.pop();
    if (!op) return;
    sync();
    if (op.type === "add") {
      deleteStrokes.mutate(op.strokes.map((s) => s.id));
      redoRef.current.push(op);
    } else {
      // Restoring assigns new ids, so the redo entry must carry those or a
      // later redo would try to delete rows that no longer exist.
      const restored = await restore(op.strokes);
      redoRef.current.push({ type: "erase", strokes: restored });
    }
    sync();
  }, [deleteStrokes, restore]);

  const redo = useCallback(async () => {
    const op = redoRef.current.pop();
    if (!op) return;
    sync();
    if (op.type === "add") {
      const restored = await restore(op.strokes);
      undoRef.current.push({ type: "add", strokes: restored });
    } else {
      deleteStrokes.mutate(op.strokes.map((s) => s.id));
      undoRef.current.push(op);
    }
    sync();
  }, [deleteStrokes, restore]);

  return {
    strokes,
    addStroke,
    eraseStrokes,
    undo,
    redo,
    canUndo: depths.undo > 0,
    canRedo: depths.redo > 0,
  };
}
