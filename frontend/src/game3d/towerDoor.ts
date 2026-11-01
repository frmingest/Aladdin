/**
 * Walking up to a holding's tower (game3d, 2026-11-01). Pure data and maths, no three.js and no React.
 * Every tower has a small timber door on the side that faces the middle of the courtyard. Stand near it
 * and E takes you into that tower's library. Which tower you can enter depends only on where it stands.
 */
import { COBBLE_RADIUS, KEEP, RESERVED_ZONES, towerSpots, type Spot } from "./layout";
import { DESK, SHELF } from "./desk";
import { NPCS } from "./npcs";

/** Reach from the tower's wall (its radius), not from its middle: fat towers are not easier to enter. */
export const ENTER_REACH = 3.4;
export const ENTER_LEAVE_REACH = 4.6;

export interface Enterable {
  holdingId: string;
  spot: Spot;
  radius: number;
}

/** Yaw (about the vertical axis, 0 = facing +z) from a tower toward the middle of the courtyard. */
export function doorYaw(spot: Spot): number {
  return Math.atan2(-spot.x, -spot.z);
}

/** Where the door is, on the tower wall (a little outside the stone). */
export function doorSpot(spot: Spot, radius: number): Spot {
  const yaw = doorYaw(spot);
  return { x: spot.x + Math.sin(yaw) * (radius + 0.1), z: spot.z + Math.cos(yaw) * (radius + 0.1) };
}

interface Blocker {
  x: number;
  z: number;
  /** Stay at least this far from the middle. */
  r: number;
}

/** Things the hero must not be put inside: furniture, people, the other pads, ground held for later. */
function blockers(pads: readonly Spot[], self: Spot): Blocker[] {
  return [
    { x: DESK.x, z: DESK.z, r: 2.4 },
    { x: SHELF.x, z: SHELF.z, r: 2.4 },
    ...NPCS.map((n) => ({ x: n.x, z: n.z, r: 1.6 })),
    ...pads.filter((p) => p.x !== self.x || p.z !== self.z).map((p) => ({ x: p.x, z: p.z, r: 2.1 + 1.2 })),
    ...RESERVED_ZONES.map((z) => ({ x: z.x, z: z.z, r: z.radius })),
  ];
}

function clear(p: Spot, bl: readonly Blocker[]): boolean {
  if (Math.hypot(p.x, p.z) > COBBLE_RADIUS - 1) return false;
  // The keep is a box; keep a body-width clear of it.
  if (Math.abs(p.x - KEEP.x) < KEEP.width / 2 + 1 && Math.abs(p.z - KEEP.z) < KEEP.depth / 2 + 1) return false;
  return bl.every((b) => Math.hypot(p.x - b.x, p.z - b.z) >= b.r);
}

/**
 * Where the hero stands when coming back out: in front of the door, clear of the stone. If something stands
 * there (the writing desk's shelf is close to one pad), slide round the tower, then step a little further out,
 * until the spot is clear. The first choice is straight in front of the door.
 */
export function exitSpot(spot: Spot, radius: number, pads: readonly Spot[] = towerSpots()): Spot {
  const bl = blockers(pads, spot);
  const yaw = doorYaw(spot);
  for (const extra of [2.2, 3.2, 4.2]) {
    for (const turn of [0, 0.45, -0.45, 0.9, -0.9]) {
      const a = yaw + turn;
      const p = { x: spot.x + Math.sin(a) * (radius + extra), z: spot.z + Math.cos(a) * (radius + extra) };
      if (clear(p, bl)) return p;
    }
  }
  // Nothing clear (the layout would have to change): straight in front of the door, as first planned.
  return { x: spot.x + Math.sin(yaw) * (radius + 2.2), z: spot.z + Math.cos(yaw) * (radius + 2.2) };
}

/** Camera yaw for stepping out: the camera sits behind the hero, on the tower's side. */
export function exitCameraYaw(spot: Spot, out: Spot): number {
  return Math.atan2(spot.x - out.x, spot.z - out.z);
}

export function nearestTower(
  pos: { x: number; z: number },
  towers: readonly Enterable[],
  reach: number = ENTER_REACH,
): Enterable | null {
  let best: Enterable | null = null;
  let bestD = Infinity;
  for (const t of towers) {
    const d = Math.hypot(t.spot.x - pos.x, t.spot.z - pos.z) - t.radius;
    if (d <= reach && d < bestD) {
      best = t;
      bestD = d;
    }
  }
  return best;
}
