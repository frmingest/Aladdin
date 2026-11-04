/**
 * The fountain square dressing (S26 PR 4). Pure data and maths, no three.js and no React.
 *
 * A round fountain with a ring of six columns and a well. It wears the condition ladder with ONE rule: the numbers come from
 * the LandCondition (itself from the wall tier alone), nothing else. Missing and fallen columns are the `gaps` and `rubble`,
 * the lean is the `lean`, props and loose planks are the `props` and `looseBoards`, the cracked rim is the `crack`, the plain
 * rim patches are the `patches`, and the stone footing is the `trim` (so the neutral, which has none, never reads as Sound).
 * Nothing here reads a sector, a weight, a size, a margin of safety or a verdict, and no count grows with a gain.
 * Condition is shape, lean and rubble, never colour.
 */
import type { LandCondition } from "./landCondition";

export const COLUMN_SLOTS = 6;
/** The columns stand on this ring round the fountain (world units from its centre), inside the stream band. */
export const COLUMN_RING = 1.95;
export const FOUNTAIN_SCALE = 1.3;
export const COLUMN_SCALE = 0.75;
export const WELL_SCALE = 1.4;
/** The well stands between two columns, a little outside the ring. */
export const WELL_ANGLE = Math.PI / COLUMN_SLOTS;

export type ColumnState = "standing" | "gone" | "fallen";

export interface ColumnPlan {
  slot: number;
  /** Angle of the slot round the centre, radians. */
  angle: number;
  state: ColumnState;
  /** Lean in degrees for a standing column (sign alternates by slot so the ring does not all lean one way). */
  lean: number;
}

export interface PropPlan { angle: number; broken: boolean }
export interface MarkPlan { angle: number }

export interface FountainPlan {
  columns: ColumnPlan[];
  standing: number;
  fallen: number;
  props: PropPlan[];
  looseBoards: number;
  /** Plain repair patches on the rim. */
  patches: MarkPlan[];
  /** Dark crack bars across the rim (3 on the failing rung, else none). */
  cracks: MarkPlan[];
  /** Height of the stone footing; 0 means none. */
  footing: number;
  /** Pale, see-through. The slot draws the ghost itself, so a dressing never gets this; kept so the plan is total. */
  pale: boolean;
}

const slotAngle = (slot: number): number => (slot / COLUMN_SLOTS) * Math.PI * 2;

/**
 * The plan for a condition. Columns are lost from the far slots first, so the same slots stand on the better rungs
 * (a worse wall never has a column the better wall lacks): gone = min(gaps, 6); of those, `rubble` lie fallen on the ground
 * and the rest are simply missing.
 */
export function fountainPlan(c: LandCondition): FountainPlan {
  const lost = Math.min(c.gaps, COLUMN_SLOTS);
  const fallenCount = Math.min(c.rubble, lost);
  const columns: ColumnPlan[] = Array.from({ length: COLUMN_SLOTS }, (_, i) => {
    const slot = COLUMN_SLOTS - 1 - i; // lose slot 5 first, then 4, ...
    const index = i; // i-th lost
    const state: ColumnState = index < lost ? (index < fallenCount ? "fallen" : "gone") : "standing";
    return { slot, angle: slotAngle(slot), state, lean: state === "standing" ? (slot % 2 ? -c.lean : c.lean) : 0 };
  }).sort((a, b) => a.slot - b.slot);
  const standing = columns.filter((x) => x.state === "standing").length;
  return {
    columns,
    standing,
    fallen: columns.filter((x) => x.state === "fallen").length,
    props: Array.from({ length: c.props }, (_, i) => ({ angle: slotAngle(i * 2 + 1) + 0.25, broken: i < c.brokenProps })),
    looseBoards: c.looseBoards,
    patches: Array.from({ length: c.patches }, (_, i) => ({ angle: -0.8 - i * 0.45 })),
    cracks: c.crack > 0 ? [-0.12, 0, 0.12].map((d) => ({ angle: Math.PI / 2 + d })) : [],
    footing: c.trim > 0 ? 0.05 + 0.1 * c.trim : 0,
    pale: c.pale,
  };
}
