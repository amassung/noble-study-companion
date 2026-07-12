import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GripVertical, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TextBox } from "@/lib/boxes/boxes-api";
import { useBoxes, useDeleteBoxMutation, useUpdateBoxMutation } from "@/lib/boxes/use-boxes";

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Overlay of free-floating, draggable/resizable text boxes on a note's page
 * (GoodNotes-style). Sits above the doc-flow editor: the layer itself is
 * pointer-transparent so normal typing still works, and each box re-enables
 * pointer events for itself.
 */
export function FreeformLayer({ noteId }: { noteId: string }) {
  const { data: boxes = [] } = useBoxes(noteId);
  const layerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-10">
      {boxes.map((b) => (
        <FreeformTextBox key={b.id} box={b} noteId={noteId} layerRef={layerRef} />
      ))}
    </div>
  );
}

function FreeformTextBox({
  box,
  noteId,
  layerRef,
}: {
  box: TextBox;
  noteId: string;
  layerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const update = useUpdateBoxMutation(noteId);
  const del = useDeleteBoxMutation(noteId);

  // Local copy for smooth dragging/typing; re-sync only when a different box
  // object arrives (not on every keystroke, which would clobber the caret).
  const [local, setLocal] = useState(box);
  useEffect(() => {
    setLocal(box);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.id]);

  const [active, setActive] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-grow the textarea height to fit its content.
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [local.content, local.fontSize, local.width]);

  const commit = (patch: Partial<TextBox>) => update.mutate({ id: box.id, patch });

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const layer = layerRef.current;
    if (!layer) return;
    const w = layer.getBoundingClientRect().width;
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = local.x;
    const origY = local.y;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / w;
      const dy = ev.clientY - startY;
      setLocal((l) => ({
        ...l,
        x: clamp(origX + dx, 0, 0.9),
        y: Math.max(0, origY + dy),
      }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLocal((l) => {
        commit({ x: l.x, y: l.y });
        return l;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const layer = layerRef.current;
    if (!layer) return;
    const w = layer.getBoundingClientRect().width;
    const startX = e.clientX;
    const origW = local.width;
    const move = (ev: PointerEvent) => {
      const dw = (ev.clientX - startX) / w;
      setLocal((l) => ({ ...l, width: clamp(origW + dw, 0.12, 0.95) }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setLocal((l) => {
        commit({ width: l.width });
        return l;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onContentChange = (value: string) => {
    setLocal((l) => ({ ...l, content: value }));
    if (contentTimer.current) clearTimeout(contentTimer.current);
    contentTimer.current = setTimeout(() => commit({ content: value }), 400);
  };

  return (
    <div
      className="pointer-events-auto absolute"
      style={{ left: `${local.x * 100}%`, top: `${local.y}px`, width: `${local.width * 100}%` }}
      onPointerDown={() => setActive(true)}
    >
      <div
        className={cn(
          "group relative rounded-md transition-colors",
          active ? "ring-2 ring-primary/50" : "ring-1 ring-transparent hover:ring-primary/30",
        )}
      >
        {/* Drag handle */}
        <button
          type="button"
          aria-label="Move text box"
          onPointerDown={startDrag}
          className={cn(
            "absolute -left-6 top-0 flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded-md bg-primary/20 text-primary opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100",
            active && "opacity-100",
          )}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {/* Delete */}
        <button
          type="button"
          aria-label="Delete text box"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={() => del.mutate(box.id)}
          className={cn(
            "absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100",
            active && "opacity-100",
          )}
        >
          <XIcon className="h-3 w-3" />
        </button>

        <textarea
          ref={taRef}
          value={local.content}
          onChange={(e) => onContentChange(e.target.value)}
          onFocus={() => setActive(true)}
          onBlur={() => {
            setActive(false);
            if (contentTimer.current) clearTimeout(contentTimer.current);
            commit({ content: local.content });
          }}
          placeholder="Text…"
          rows={1}
          style={{ fontSize: `${local.fontSize}px` }}
          className="nobi-box-text block w-full resize-none rounded-md bg-transparent px-1.5 py-1 leading-snug outline-none placeholder:text-muted-foreground/50"
        />

        {/* Resize handle (width) */}
        <button
          type="button"
          aria-label="Resize text box"
          onPointerDown={startResize}
          className={cn(
            "absolute -bottom-1 -right-1 h-3.5 w-3.5 cursor-ew-resize touch-none rounded-sm border border-primary/60 bg-[var(--surface)] opacity-0 transition-opacity group-hover:opacity-100",
            active && "opacity-100",
          )}
        />
      </div>
    </div>
  );
}
