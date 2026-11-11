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
  // The two advisors stand side by side just inside the gate, west of the road in, so you meet both on your way in.
  // Barren Wuffet is the one nearer the road. They are about 3 units apart: close enough to read as a pair, far enough
  // that the figures do not overlap, and the nearer one is the one who answers E.
  { id: "oracle", name: "Barren Wuffet", tagline: "The patient one", x: -7.4, z: 26.4, facing: Math.atan2(7.4, -26.4), art: "oracle", height: 2.0 },
  { id: "partner", name: "Marlie Chunger", tagline: "The blunt one", x: -10.5, z: 25.5, facing: Math.atan2(7, -17), art: "partner", height: 2.0 },
];


/** Close enough to start talking, and how far you may drift before the talk ends. */
export const TALK_RANGE = 3.6;
export const LEAVE_RANGE = 5.2;

/** The two advisors stand this close together, at most (a test keeps them a pair). */
export const ADVISOR_PAIR_MAX_GAP = TALK_RANGE;
/** ...and at least this far apart, so the two bodies never overlap. */
export const ADVISOR_PAIR_MIN_GAP = 2;

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

/** The small line under the "talk to" prompt: the other advisor who stands beside this one. Null if nobody is close enough. */
export function alsoHereNote(id: NpcId, npcs: readonly Npc[] = NPCS): string | null {
  const me = npcs.find((n) => n.id === id);
  if (!me) return null;
  const other = npcs.find((n) => n.id !== id && Math.hypot(n.x - me.x, n.z - me.z) <= ADVISOR_PAIR_MAX_GAP);
  return other ? `Also here: ${other.name}` : null;
}
