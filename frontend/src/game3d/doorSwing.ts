/**
 * Doors that swing (polish pass PR 3). Pure maths and one tiny shared value, no three.js and no React: how far a door
 * leaf is open at a moment. Decoration only: every holding has the same door, it carries no fact, and E works the same
 * whether the leaf has finished swinging or not.
 */

/** How far a leaf opens, in radians (a little under a quarter turn, so it never looks flung). */
export const DOOR_OPEN_ANGLE = 1.45;
/** Seconds a leaf takes to swing all the way. */
export const DOOR_SWING_SECONDS = 0.4;

/** The angle one frame later. Eases linearly towards open or shut; with reduced motion it cuts straight there. */
export function stepSwing(angle: number, open: boolean, dt: number, reduced: boolean): number {
  const target = open ? DOOR_OPEN_ANGLE : 0;
  if (reduced) return target;
  const step = (DOOR_OPEN_ANGLE / DOOR_SWING_SECONDS) * Math.max(0, dt);
  if (angle < target) return Math.min(target, angle + step);
  return Math.max(target, angle - step);
}

/**
 * Which way the leaf turns about its hinge (the sign for rotation.y). `extend` is the side the leaf reaches from its
 * hinge along the door's own x axis (+1 or -1); `swing` is whether it opens towards the lane ("out") or towards the
 * building ("in"). Local +z points out to the lane.
 */
export function swingSign(extend: 1 | -1, swing: "in" | "out"): 1 | -1 {
  return (extend * (swing === "in" ? 1 : -1)) as 1 | -1;
}

/** The holding whose door the hero stands at, or null. Written by the scene, read by the door leaves. */
let openDoorId: string | null = null;
export function setOpenDoor(id: string | null): void {
  openDoorId = id;
}
export function getOpenDoor(): string | null {
  return openDoorId;
}
