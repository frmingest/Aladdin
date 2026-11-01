/**
 * The Night Watch post and the raven perch (3D sprint S16, PR 2). Pure data and maths, no three.js and no React.
 *
 * The flat Fortress has two cards that report on the world overnight: the Night Watch dispatch (did the tripwire
 * check run, did anything fire) and the Ravens (a report was captured and these measures moved). In 3D they become
 * two things you walk up to:
 *  - the **watch post**, a lantern on a post inside the gate, west of the road (the signpost stands east of it).
 *    Press E and the flat Night Watch card opens in a world panel.
 *  - the **raven perch** that already stands east of the fountain. Birds sit on its cross-arm only when a real,
 *    unseen raven exists. Press E and the flat Ravens card opens in a world panel.
 *
 * Both are furniture around a card that already works. The only facts drawn are the ones the backend decided:
 * whether the watch reported in (and whether it needs a look), and how many ravens you have not marked seen.
 * Nothing here works out a status, a count of changes or a verdict. An unknown watch is never drawn as calm.
 */
import { SPAWN } from "./layout";
import { yawToward } from "./npcs";
import type { NightWatchStatus } from "../lib/types";

/**
 * Just inside the gate, west of the road in, a few steps behind the gate guard (townsfolk.ts) whose post it is; the
 * signpost stands on the east side. Further east it falls inside the guard's and the flag's clearance (found by the
 * placement test).
 */
export const WATCH_POST = { x: -9.5, z: 38 } as const;
export const WATCH_FACING = yawToward(WATCH_POST, SPAWN);
export const WATCH_RANGE = 3.6;
/** Wider to leave than to arrive, so standing on the edge does not flicker. */
export const WATCH_LEAVE_RANGE = 5;
/** Half the footprint of the post you walk round. */
export const WATCH_SOLID = 0.35;

/** Where the perch stands (the same spot as the `perch` prop in props.ts; a test keeps the two together). */
export const PERCH = { x: 19.5, z: 18 } as const;
export const PERCH_RANGE = 3.6;
export const PERCH_LEAVE_RANGE = 5;

/** The cross-arm holds three birds, never more. */
export const MAX_BIRDS = 3;

/** How many birds sit on the perch: one per unseen raven, up to the arm. No unseen raven, no bird. */
export function birdCount(unseenRavens: number | null | undefined): number {
  if (unseenRavens === null || unseenRavens === undefined || !Number.isFinite(unseenRavens) || unseenRavens <= 0) return 0;
  return Math.min(MAX_BIRDS, Math.floor(unseenRavens));
}

export interface BirdSlot {
  /** Along the cross-arm, in the perch's own coordinates. */
  x: number;
  /** Which way the bird faces. Fixed per slot, never data. */
  yaw: number;
}

const BIRD_SLOTS: readonly BirdSlot[] = [
  { x: 0.2, yaw: 0.5 },
  { x: 0.78, yaw: -0.35 },
  { x: 1.2, yaw: 0.9 },
];

/** Fixed slots, filled in the same order whatever the count, so another raven adds a bird and never moves one. */
export function birdSlots(count: number): BirdSlot[] {
  const n = Number.isFinite(count) ? Math.max(0, Math.min(MAX_BIRDS, Math.floor(count))) : 0;
  return BIRD_SLOTS.slice(0, n);
}

export interface WatchLook {
  /** The lantern burns: the watch reported in. A watch that did not report in stays dark. */
  lit: boolean;
  /** Printed after the name on the plate, so colour is never the only signal. */
  mark: "" | "!" | "?";
}

/**
 * What the post says, from the status the backend already decided. "Quiet" is only ever sent for a watch that
 * reported in, so a dark lantern with a "?" is the one picture for "not reporting" and for "could not be read".
 */
export function watchLook(status: NightWatchStatus | null | undefined): WatchLook {
  if (status === "attention") return { lit: true, mark: "!" };
  if (status === "quiet") return { lit: true, mark: "" };
  return { lit: false, mark: "?" };
}

export function nearWatch(pos: { x: number; z: number }, range: number = WATCH_RANGE): boolean {
  return Math.hypot(WATCH_POST.x - pos.x, WATCH_POST.z - pos.z) <= range;
}

export function nearPerch(pos: { x: number; z: number }, range: number = PERCH_RANGE): boolean {
  return Math.hypot(PERCH.x - pos.x, PERCH.z - pos.z) <= range;
}
