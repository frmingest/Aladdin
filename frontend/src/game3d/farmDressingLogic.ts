/**
 * The farmhouse dressing (S26 PR 3). Pure data and maths, no three.js and no React.
 *
 * The centre of a food land is a farmhouse in a fenced yard. The CONDITION (wall tier alone) decides how it wears:
 * lean, gaps in the fence, empty field patches, props, loose boards, fallen lumber, a crack. The theme (sector) decides
 * only which pieces stand there. The stream (moat tier) is drawn by the land's shared stream band, not here.
 *
 * The fish farm: a holding whose sector or name says fish, salmon, seafood or aquaculture gets round open tanks with
 * silver-blue fish in place of the back fields. The tanks and fish are scenery: their number is fixed, so no value,
 * gain, weight or verdict can grow or shrink them. Fish are silver-blue, never red or orange.
 */
import type { LandCondition } from "./landCondition";

/** The exact fish test: against the sector text and the holding's name. Loose, case-insensitive. */
const FISH = /fish|salmon|seafood|aquacult|trout|\bsea ?food/i;

export function isFishFarm(t: { sector?: string | null; name?: string | null }): boolean {
  return FISH.test(t.sector ?? "") || FISH.test(t.name ?? "");
}

/** Fixed, whatever any value says. */
export const FISH_TANKS = 3;
export const FISH_PER_TANK = 4;
/** Silver-blue body and belly; the test keeps them off red, orange and green. */
export const FISH_COLORS = ["#a9bfd2", "#8fa9c2"] as const;
export const TANK_WATER = "#7fa3c7";

/** Field slots in the yard (front-left, front-right, back-left, back-right). */
export const FIELD_SLOTS = 4;
/** Fence segments round the yard. */
export const FENCE_SEGMENTS = 8;
/** Fallen-lumber places in front of the house. */
export const LUMBER_SPOTS = 5;

export interface FarmLook {
  /** House lean in degrees. */
  lean: number;
  /** Fence segments that are missing (0 to 8). */
  fenceGaps: number;
  /** Field slots that show bare dirt, not grain (0 to 4). Fish farms have tanks in the back slots instead. */
  emptyFields: number;
  props: number;
  brokenProps: number;
  looseBoards: number;
  /** Fallen lumber pieces on the ground. */
  lumber: number;
  patches: number;
  crack: boolean;
  /** Hedge at the front: none, plain, or full (the proud finish). */
  hedge: "none" | "hedge" | "large";
}

/** What the farm wears for a rung. Only ever called for a rung: the ghost and the neutral are drawn by the slot. */
export function farmLook(c: LandCondition): FarmLook {
  return {
    lean: c.lean,
    fenceGaps: Math.min(FENCE_SEGMENTS, c.gaps),
    emptyFields: Math.min(FIELD_SLOTS, Math.ceil(c.gaps / 2)),
    props: c.props,
    brokenProps: c.brokenProps,
    looseBoards: c.looseBoards,
    lumber: Math.min(LUMBER_SPOTS, c.rubble),
    patches: c.patches,
    crack: c.crack > 0,
    hedge: c.trim >= 1 ? "large" : c.trim > 0 ? "hedge" : "none",
  };
}

/** Yard layout in the land's local units (the land centre is 0,0). */
export const FIELD_AT: readonly [number, number][] = [
  [-2.6, 2.4], [2.6, 2.4], [-2.6, -2.6], [2.6, -2.6],
];
/** Fence ring: segment i sits at this angle on a radius, facing the middle. */
export const FENCE_RADIUS = 4.3;
export function fenceAt(i: number): { x: number; z: number; yaw: number } {
  const a = (i / FENCE_SEGMENTS) * Math.PI * 2;
  return { x: Math.cos(a) * FENCE_RADIUS, z: Math.sin(a) * FENCE_RADIUS, yaw: -a };
}
export const TANK_AT: readonly [number, number][] = [[-2.8, -2.6], [0, -3.6], [2.8, -2.6]];
