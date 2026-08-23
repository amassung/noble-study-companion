import { useEffect, useState } from "react";

/**
 * Height in CSS pixels that the on-screen keyboard covers at the bottom of the
 * window, or 0 when no keyboard is up.
 *
 * iOS does not resize the layout viewport when the keyboard opens — only the
 * visual viewport shrinks. Left uncompensated, the bottom of a scrollable
 * editor sits underneath the keys: the caret vanishes as soon as typing
 * reaches the lower half of the page, and scrolling cannot reveal it because
 * the scrollable area itself ends behind the keyboard. Google Docs behaves the
 * way students expect here — the page shortens so the caret always has room.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // Gap between the bottom of the visual viewport and the bottom of the
      // layout viewport. Rubber-band scrolling can make this briefly negative,
      // and a small value is ordinary browser chrome rather than a keyboard,
      // so only a substantial inset counts.
      const covered = window.innerHeight - (vv.height + vv.offsetTop);
      setInset(covered > 80 ? Math.round(covered) : 0);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}
