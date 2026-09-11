/**
 * Backing-store resolution for the ink canvases, in device pixels per CSS px.
 *
 * Handwriting is rasterised, so when the page is scaled by a CSS transform the
 * bitmap is magnified and the ink goes soft — the giveaway that you are
 * looking at a zoomed web page rather than a notebook. Rendering the strokes
 * into a backing store that already accounts for the zoom keeps the edges
 * crisp at any scale.
 *
 * The cap matters as much as the scaling: cost grows with the square, and two
 * canvases at an uncapped 3x zoom on a 2x screen would be ~6x, or roughly
 * 100MB of pixels on an iPad — for detail past the point the eye resolves.
 */
export const MAX_INK_SCALE = 3.5;

/**
 * Most device pixels one ink canvas may occupy.
 *
 * Scale alone is not enough of a bound, because the page grows as pages are
 * added: at 3.5x a two-page note is already past the ~16.7M-pixel ceiling
 * Safari enforces on iOS, and a five-page note asks for 54M. Over that line a
 * canvas does not merely get slow — it can fail to allocate, which would take
 * the handwriting with it. Staying under it costs sharpness on very long
 * notes, which is the right thing to give up.
 */
export const MAX_INK_AREA = 12_000_000;

/**
 * The floor the area budget may push resolution down to.
 *
 * Below 1x ink is softer than the screen it sits on, which is a poor trade —
 * but only up to a point. A long enough note cannot fit under the ceiling at
 * 1x at all, and a canvas that fails to allocate loses the handwriting
 * outright. Soft ink beats no ink, so the floor sits below 1 rather than at
 * it. Notes long enough to reach it want viewport-windowed rendering, which
 * is the real fix and a larger change than this one.
 */
export const MIN_INK_SCALE = 0.5;

export function inkResolution(
  devicePixelRatio: number,
  zoom: number,
  /** Canvas size in CSS px. Omitted, only the scale caps apply. */
  cssWidth?: number,
  cssHeight?: number,
): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const wanted = Math.min(dpr * z, MAX_INK_SCALE);

  const w = Number.isFinite(cssWidth) && (cssWidth ?? 0) > 0 ? (cssWidth as number) : 0;
  const h = Number.isFinite(cssHeight) && (cssHeight ?? 0) > 0 ? (cssHeight as number) : 0;
  if (!w || !h) return wanted;

  // Area scales with the square of the resolution, so the affordable scale is
  // the square root of the budget over the CSS area.
  const affordable = Math.sqrt(MAX_INK_AREA / (w * h));
  return Math.max(MIN_INK_SCALE, Math.min(wanted, affordable));
}
