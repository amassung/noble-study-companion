/**
 * Apple Pencil hardware gestures, as they reach the web layer.
 *
 * WebKit gives web content no way to observe the Pencil's squeeze or
 * double-tap, so the native side (ios/App/App/PencilViewController.swift)
 * receives them and re-dispatches them as a DOM event. This is the web half
 * of that contract: the event name and payload must stay in step with the
 * Swift, and the meaning of each gesture is decided here so changing it ships
 * as a web deploy rather than another App Store review.
 */

export type PencilGesture = "squeeze" | "doubletap";

export const PENCIL_EVENT = "nobi:pencil";

/** Subscribe to Pencil gestures. Returns an unsubscribe function. */
export function onPencilGesture(handler: (gesture: PencilGesture) => void): () => void {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<{ gesture?: string }>).detail;
    const g = detail?.gesture;
    // Anything unrecognised is ignored rather than guessed at: a future
    // gesture added natively should do nothing here, not the wrong thing.
    if (g === "squeeze" || g === "doubletap") handler(g);
  };
  window.addEventListener(PENCIL_EVENT, listener);
  return () => window.removeEventListener(PENCIL_EVENT, listener);
}
