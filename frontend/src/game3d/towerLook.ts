/**
 * Fixed size and moat tables for towers (split out of stateToWorld so the outdoor plan can read them without a
 * circular import). Pure data; `stateToWorld` re-exports them.
 */
import type { FortressMoat, FortressSize, FortressWall } from "../lib/types";

/** Tower height (world units) by size class. Unknown size is a low stub, drawn in fog. */
export const SIZE_HEIGHT: Record<FortressSize, number> = {
  great: 15,
  medium: 11,
  small: 8,
  tiny: 5.5,
  unknown: 4,
};

export const SIZE_RADIUS: Record<FortressSize, number> = {
  great: 2.1,
  medium: 1.8,
  small: 1.5,
  tiny: 1.2,
  unknown: 1.3,
};

/** Moat ring width by tier. Not surveyed is fog, drawn as mist (see `moatFog`). */
export const MOAT_WIDTH: Record<FortressMoat, number> = {
  wide: 2.2,
  narrow: 1,
  none: 0,
  unsurveyed: 0,
  not_applicable: 0,
};

/** Fixed look per wall material. `integrity` orders them: higher is sturdier. */
export const WALL_LOOK: Record<FortressWall, { color: string; integrity: number | null; crenels: number; cracks: number }> = {
  basalt: { color: "#4a4f57", integrity: 1, crenels: 8, cracks: 0 },
  granite: { color: "#8d8a85", integrity: 0.8, crenels: 8, cracks: 0 },
  brick: { color: "#a35f4a", integrity: 0.6, crenels: 6, cracks: 1 },
  timber: { color: "#8a6a43", integrity: 0.35, crenels: 4, cracks: 2 },
  rotted: { color: "#5f6a4f", integrity: 0.1, crenels: 2, cracks: 4 },
  unsurveyed: { color: "#cfd6dc", integrity: null, crenels: 0, cracks: 0 },
  not_applicable: { color: "#b9b2a6", integrity: null, crenels: 0, cracks: 0 },
};
