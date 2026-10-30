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
/** Eight places for the eight holdings (week 2 puts real towers here). */
export const TOWER_SPOT_COUNT = 8;
export const TOWER_SPOT_RADIUS = 15;

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

/** Holding-tower spots in an arc across the north half of the courtyard. */
export function towerSpots(count = TOWER_SPOT_COUNT, radius = TOWER_SPOT_RADIUS): Spot[] {
  const span = 2.3; // radians, centred on due north
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = Math.PI - span / 2 + span * t;
    return { x: radius * Math.sin(angle), z: radius * Math.cos(angle) };
  });
}
