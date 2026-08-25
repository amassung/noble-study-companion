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

export function inkResolution(devicePixelRatio: number, zoom: number): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  return Math.min(dpr * z, MAX_INK_SCALE);
}
