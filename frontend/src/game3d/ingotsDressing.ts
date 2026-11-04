/**
 * The gold bullion vault dressing (S27 PR 1, theme `ingots`). Pure data and maths, no three.js and no React.
 *
 * A gold chest, bar stacks on a pallet, a silver stack and two coin stacks sit inside a ring of six low barred barriers.
 * The barriers wear the condition ladder exactly as the fountain's columns do (same slots lost first, same props, boards,
 * patches, crack and footing), so this file reuses `fountainPlan` rather than copying it: the numbers come from the
 * LandCondition, which comes from the wall tier alone.
 *
 * THE GOLD NEVER MOVES. The piles are a fixed list below. No count, height or size of gold, silver or coin depends on the
 * wall tier, the weight, the size class, a gain, a margin of safety or a verdict, so a bigger or better holding never has
 * more gold on show. Condition is shape, lean and rubble, never colour.
 */
import { COLUMN_SLOTS, fountainPlan } from "./fountainDressing";
import type { FountainPlan } from "./fountainDressing";
import type { LandCondition } from "./landCondition";

export const BARRIER_SLOTS = COLUMN_SLOTS;
/** The barriers stand on this ring (world units from the centre), inside the stream band. */
export const BARRIER_RING = 2.0;
/** gate barrier is 4 wide, 1.4 high, 0.7 deep in the file; at this scale a slot is about 2 wide and 0.7 high. */
export const BARRIER_SCALE = 0.5;

/** The same plan as the fountain, read as barriers: `columns` are the six barrier slots. */
export type IngotsPlan = FountainPlan;
export const ingotsPlan = (c: LandCondition): IngotsPlan => fountainPlan(c);

export interface Pile {
  node: string;
  scale: number;
  /** Angle and distance from the centre; r 0 means the middle. */
  angle: number;
  r: number;
  /** Height the piece stands at (a pile on a pallet stands on it). */
  y?: number;
  rotation?: number;
}

/** The fixed treasure. Same for every holding, every rung and the neutral. A test pins it. */
export const PILES: readonly Pile[] = [
  { node: "chest_gold", scale: 0.75, angle: 0, r: 0 },
  { node: "pallet_tarp", scale: 0.45, angle: 0.9, r: 1.15 },
  { node: "gold_bars_stack_large", scale: 0.4, angle: 0.9, r: 1.15, y: 0.14 },
  { node: "gold_bars_stack_medium", scale: 0.45, angle: 2.4, r: 1.15 },
  { node: "silver_bars_stack_small", scale: 0.5, angle: 3.9, r: 1.1 },
  { node: "coin_stack_medium", scale: 0.55, angle: 5.0, r: 1.2 },
  { node: "coin_stack_small", scale: 0.55, angle: 5.5, r: 1.25 },
];

/** Where barrier `slot` stands and how it faces (its long side runs along the ring). */
export const barrierAt = (angle: number): { x: number; z: number; rotY: number } => ({
  x: Math.cos(angle) * BARRIER_RING,
  z: Math.sin(angle) * BARRIER_RING,
  rotY: -angle - Math.PI / 2,
});
