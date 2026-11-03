/**
 * The condition ladder (S26 PR 1). Pure data and maths, no three.js and no React.
 *
 * One fixed ladder that every dressing (mill, farm, fountain, mine, and the plain block) wears, so a weak holding is
 * as easy to read as a strong one. The numbers depend on the WALL TIER ALONE: not the sector, the weight, the size,
 * the margin of safety or the verdict. A dressing only chooses which pieces wear them.
 *
 *   basalt -> Sound    granite -> Solid    brick -> Worn    timber -> Patched    rotted -> Failing    (the five rungs)
 *   unsurveyed (or no wall read at all) -> Ghost   (fog: drawn pale, no detail; it is NOT a rung)
 *   not_applicable (no balance sheet to judge)     -> Neutral (plain; it is NOT a rung and never reads as Sound)
 *
 * Condition is shape, lean and rubble, never colour (colour-blind safe, and no red or green).
 */
import type { FortressWall } from "../lib/types";

export type RungName = "sound" | "solid" | "worn" | "patched" | "failing";
export type ConditionState = "rung" | "ghost" | "neutral";

export interface LandCondition {
  state: ConditionState;
  /** 0 (Sound) to 4 (Failing); null for the ghost and the neutral, which are not rungs. */
  rung: number | null;
  name: RungName | null;
  /** How far the pieces lean, in degrees. */
  lean: number;
  /** Missing slats or planks. */
  gaps: number;
  /** Props holding something up. */
  props: number;
  /** Of the props, how many are broken. */
  brokenProps: number;
  /** Loose planks hanging off. */
  looseBoards: number;
  /** Fallen pieces on the ground. */
  rubble: number;
  /** Plain repair patches. */
  patches: number;
  /** 0 or 1: a crack across the front. */
  crack: number;
  /** How proud the finish is (stone footing, trimmed edge): 1 on Sound, falling to 0. Neutral has none, so it never reads as Sound. */
  trim: number;
  /** Drawn pale, in mist, with no detail. Only the ghost. */
  pale: boolean;
}

/** The five rungs, best to worst. Each damage field never goes down as the wall gets worse. */
export const RUNGS: readonly LandCondition[] = [
  { state: "rung", rung: 0, name: "sound", lean: 0, gaps: 0, props: 0, brokenProps: 0, looseBoards: 0, rubble: 0, patches: 0, crack: 0, trim: 1, pale: false },
  { state: "rung", rung: 1, name: "solid", lean: 0, gaps: 0, props: 0, brokenProps: 0, looseBoards: 0, rubble: 0, patches: 1, crack: 0, trim: 0.5, pale: false },
  { state: "rung", rung: 2, name: "worn", lean: 2, gaps: 2, props: 1, brokenProps: 0, looseBoards: 0, rubble: 0, patches: 1, crack: 0, trim: 0, pale: false },
  { state: "rung", rung: 3, name: "patched", lean: 5, gaps: 4, props: 3, brokenProps: 0, looseBoards: 2, rubble: 1, patches: 2, crack: 0, trim: 0, pale: false },
  { state: "rung", rung: 4, name: "failing", lean: 9, gaps: 7, props: 3, brokenProps: 2, looseBoards: 3, rubble: 5, patches: 2, crack: 1, trim: 0, pale: false },
];

/** Fog: pale, no detail, no rung. */
export const GHOST: LandCondition = {
  state: "ghost", rung: null, name: null, lean: 0, gaps: 0, props: 0, brokenProps: 0, looseBoards: 0, rubble: 0, patches: 0, crack: 0, trim: 0, pale: true,
};

/** Plain, undamaged and not proud. Not Sound: it has no footing or trim, and it is not on the ladder. */
export const NEUTRAL: LandCondition = {
  state: "neutral", rung: null, name: null, lean: 0, gaps: 0, props: 0, brokenProps: 0, looseBoards: 0, rubble: 0, patches: 0, crack: 0, trim: 0, pale: false,
};

const RUNG_OF_WALL: Partial<Record<FortressWall, number>> = { basalt: 0, granite: 1, brick: 2, timber: 3, rotted: 4 };

/**
 * The condition for a wall tier, and nothing else. A wall that has not been read (or was never given) is a ghost: unknown
 * stays fog, never a middle grade. "Not applicable" is neutral.
 */
export function landCondition(wall: FortressWall | null | undefined): LandCondition {
  if (wall === "not_applicable") return NEUTRAL;
  const r = wall ? RUNG_OF_WALL[wall] : undefined;
  return r === undefined ? GHOST : RUNGS[r]!;
}

/** The damage numbers that must never fall as the wall gets worse. */
export const DAMAGE_FIELDS = ["lean", "gaps", "props", "brokenProps", "looseBoards", "rubble", "patches", "crack"] as const;
