/**
 * The two people in the courtyard (game3d, week 3). Pure data and maths, no three.js. Shown as solid figures (week 5).
 * They are the same two advisors as the flat Fortress (there still "The Oracle" and
 * "The Partner"), here called Barren Wuffet (patient) and Marlie Chunger (blunt). The ids
 * "oracle" and "partner" stay as the internal keys. Where they stand never depends on any holding.
 */

export type NpcId = "oracle" | "partner";

export interface Npc {
  id: NpcId;
  name: string;
  /** One short line under the name when you talk to them. */
  tagline: string;
  x: number;
  z: number;
  /** Yaw so the front faces the middle of the courtyard. */
  facing: number;
  /** Which figure is theirs, and how tall it is in the world. */
  art: "oracle" | "partner";
  height: number;
}

export const NPCS: readonly Npc[] = [
  // At the keep door, off to the east side, clear of the pads.
  { id: "oracle", name: "Barren Wuffet", tagline: "The patient one", x: 9.5, z: -18, facing: Math.atan2(-9.5, 18), art: "oracle", height: 2.0 },
  // Just inside the gate, west of the road in.
  { id: "partner", name: "Marlie Chunger", tagline: "The blunt one", x: -7, z: 17, facing: Math.atan2(7, -17), art: "partner", height: 2.0 },
];

/** Close enough to start talking, and how far you may drift before the talk ends. */
export const TALK_RANGE = 3.6;
export const LEAVE_RANGE = 5.2;

export function nearestNpc(
  pos: { x: number; z: number },
  npcs: readonly Npc[] = NPCS,
  range: number = TALK_RANGE,
): Npc | null {
  let best: Npc | null = null;
  let bestD = Infinity;
  for (const n of npcs) {
    const d = Math.hypot(n.x - pos.x, n.z - pos.z);
    if (d <= range && d < bestD) {
      best = n;
      bestD = d;
    }
  }
  return best;
}

/** Yaw that turns a front facing +z toward a point (the same convention as `facing` above). */
export function yawToward(from: { x: number; z: number }, to: { x: number; z: number }): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}
