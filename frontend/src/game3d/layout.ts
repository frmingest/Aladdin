/**
 * Where things stand in the courtyard (game3d prototype, week 1). Pure data and
 * maths, no three.js. Angles run round the courtyard with 0 at the south gate:
 * position = (radius * sin(angle), radius * cos(angle)) in (x, z), so PI is north.
 */

export const WALL_RADIUS = 36;
export const WALL_HEIGHT = 6;
export const WALL_THICKNESS = 1.6;
export const COBBLE_RADIUS = 31;
export const WALL_SEGMENTS = 32;
/** Half the gate opening as an angle either side of due south. */
export const GATE_HALF_ANGLE = 0.2;
export const KEEP = { x: 0, z: -25, width: 16, depth: 12, height: 13 } as const;
export const SPAWN = { x: 0, y: 2, z: 24 } as const;
/** Eight places for the eight holdings. */
export const TOWER_SPOT_COUNT = 8;

export interface WallSegment {
  x: number;
  z: number;
  rotY: number;
  length: number;
}

function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  let r = a % twoPi;
  if (r > Math.PI) r -= twoPi;
  if (r < -Math.PI) r += twoPi;
  return r;
}

/** Straight wall pieces round the ring, leaving a gap at the south gate. */
export function wallSegments(
  radius = WALL_RADIUS,
  count = WALL_SEGMENTS,
  gateHalfAngle = GATE_HALF_ANGLE,
): WallSegment[] {
  const length = 2 * radius * Math.sin(Math.PI / count) + 0.4; // small overlap, no cracks
  const segments: WallSegment[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count;
    if (Math.abs(wrapAngle(angle)) < gateHalfAngle) continue;
    segments.push({ x: radius * Math.sin(angle), z: radius * Math.cos(angle), rotY: angle, length });
  }
  return segments;
}

export interface Spot {
  x: number;
  z: number;
}

/** Corner towers of the curtain wall, evenly round the ring and off the gate. */
export function cornerTowers(radius = WALL_RADIUS): Spot[] {
  return [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4].map((angle) => ({
    x: radius * Math.sin(angle),
    z: radius * Math.cos(angle),
  }));
}

/**
 * Holding-tower spots, in the order the biggest holdings take them (best seen first).
 * The towers stand in a wide horseshoe round the open middle: an inner pair that frames the walk from the
 * gate to the keep, then pairs on the flanks, and a pair that frames the keep itself. Neighbours are 10 or more
 * apart, and the whole south-east and south-west of the courtyard is left free (see RESERVED_ZONES).
 * Mirrored on purpose: a fortress reads as even, and the layout stays easy to reason about.
 */
const TOWER_SPOTS: readonly Spot[] = [
  { x: -10, z: -9 },
  { x: 10, z: -9 },
  { x: -23, z: -12 },
  { x: 23, z: -12 },
  { x: -16.5, z: -23.5 },
  { x: 16.5, z: -23.5 },
  { x: -23, z: -1 },
  { x: 23, z: -1 },
];

export function towerSpots(): Spot[] {
  return TOWER_SPOTS.map((s) => ({ ...s }));
}

export interface ReservedZone {
  id: string;
  x: number;
  z: number;
  /** Keep everything that stands on the cobbles outside this radius. */
  radius: number;
  /** What it is held for. */
  for: string;
}

/**
 * Open ground kept free for things that are planned but not built. Nothing is drawn here and nothing may
 * stand in it (a test checks every pad, prop, person, desk and scenery piece). When the feature is built it
 * takes the zone's place and the entry is deleted in the same change.
 */
export const RESERVED_ZONES: readonly ReservedZone[] = [
  { id: "marketplace", x: 20, z: 14, radius: 6.5, for: "the marketplace (south-east, near the gate road)" },
  { id: "siege-simulator", x: -21, z: 9, radius: 7, for: "the siege simulator (south-west, beside the camp)" },
];
