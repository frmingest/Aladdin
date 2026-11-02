/**
 * Workers (S20): two people with a job, so the courtyard has bodies at the desk and the chest.
 * Pure data and maths, no three.js. A scribe sits at the writing desk; a vault keeper stands beside the Vault chest.
 * They are furniture with a pulse: no name tag, no dialogue, no data. Where they stand depends only on where the desk
 * and the chest stand, never on a holding. They use the Sit_Chair_Idle and Use_Item clips added to the character files.
 */
import { CLIP } from "./animClips";
import { DESK, DESK_FACING } from "./desk";
import { yawToward } from "./npcs";
import { VAULT, VAULT_FACING } from "./vaultPlan";

export type WorkerId = "scribe" | "keeper";

export interface Worker {
  id: WorkerId;
  x: number;
  z: number;
  /** Yaw so the front faces the way they look (same convention as the townsfolk). */
  facing: number;
  height: number;
  /** The clip held for good. */
  pose: string;
  /** Sitting people get a small collider on the chair; standing ones a person-sized one. */
  seated: boolean;
}

/** A point in a rotated furniture group's own frame (x right, z toward the courtyard), in world coordinates. */
export function inFrame(origin: { x: number; z: number }, yaw: number, lx: number, lz: number): { x: number; z: number } {
  return {
    x: origin.x + lx * Math.cos(yaw) + lz * Math.sin(yaw),
    z: origin.z - lx * Math.sin(yaw) + lz * Math.cos(yaw),
  };
}

/** The chair stands at z = 1.15 in the desk's frame (Desk.tsx); he sits a little behind its middle so he overlaps the seat. */
const SCRIBE_AT = inFrame(DESK, DESK_FACING, 0, 1.1);
/** Beside the chest's east end (the chest is 2.4 wide), a step toward the courtyard. */
const KEEPER_AT = inFrame(VAULT, VAULT_FACING, 2.1, 0.6);

export const WORKERS: readonly Worker[] = [
  // Faces the desk: the desk's front is toward the middle, so he looks the other way.
  { id: "scribe", ...SCRIBE_AT, facing: DESK_FACING + Math.PI, height: 1.9, pose: CLIP.sit, seated: true },
  // Faces the chest.
  { id: "keeper", ...KEEPER_AT, facing: yawToward(KEEPER_AT, VAULT), height: 2.0, pose: CLIP.useItem, seated: false },
];
