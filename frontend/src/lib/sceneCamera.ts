import { SCENE_WIDTH } from "./fortress";

/**
 * The Fortress camera (D2): pure arithmetic for zoom, fit and the label floor. The scene is an SVG
 * whose width is a multiple of its container, so a zoom of 1 is "fit" and the native scroll bars
 * do the panning. Nothing here touches a stored value, the backend or the scene's own geometry.
 */

/** The scene never draws narrower than this, so a phone already scrolls sideways at zoom 1. */
export const SCENE_MIN_PX = 720;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 1.25;
/** The smallest text a person is asked to read on the Scene, in screen pixels. */
export const LABEL_FLOOR_PX = 11;
/** The smallest font size the Scene draws, in scene units (the land sign in FortressScene). */
export const LABEL_MIN_UNITS = 8.5;

export function clampZoom(z: number, max = MAX_ZOOM): number {
  if (!Number.isFinite(z)) return 1;
  return Math.min(max, Math.max(1, z));
}

/** Width in pixels the scene has at zoom 1 inside a container of this width. */
export function baseWidth(containerPx: number): number {
  return Math.max(SCENE_MIN_PX, Number.isFinite(containerPx) ? containerPx : 0);
}

/** Smallest label on screen, in pixels, at this container width and zoom. */
export function labelPx(containerPx: number, zoom: number): number {
  return (LABEL_MIN_UNITS * baseWidth(containerPx) * clampZoom(zoom)) / SCENE_WIDTH;
}

/** The zoom at which the smallest label reaches the floor (never below fit, never above the max). */
export function labelFloorZoom(containerPx: number): number {
  const need = (LABEL_FLOOR_PX / LABEL_MIN_UNITS) * SCENE_WIDTH;
  return clampZoom(need / baseWidth(containerPx));
}

export function stepZoom(z: number, dir: 1 | -1): number {
  const next = dir === 1 ? z * ZOOM_STEP : z / ZOOM_STEP;
  // Snap back onto fit instead of leaving a 1.02 that cannot be told from it.
  return next < 1.04 ? 1 : clampZoom(next);
}

/** New scroll offset that keeps the scene point under `anchor` (a pixel offset in the viewport) fixed. */
export function scrollAfterZoom(scroll: number, anchor: number, oldZoom: number, newZoom: number): number {
  if (oldZoom <= 0) return 0;
  return Math.max(0, (scroll + anchor) * (newZoom / oldZoom) - anchor);
}

/** Scroll offset that centres a box (viewport coordinates) when it is not fully visible; null if it already is. */
export function scrollToReveal(boxStart: number, boxSize: number, viewSize: number, scroll: number): number | null {
  if (boxStart >= 0 && boxStart + boxSize <= viewSize) return null;
  return Math.max(0, scroll + boxStart + boxSize / 2 - viewSize / 2);
}

export function zoomPercent(z: number): number {
  return Math.round(clampZoom(z) * 100);
}
