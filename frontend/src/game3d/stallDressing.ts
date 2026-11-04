/**
 * The market stall dressing (A3, theme `stall`). Pure data and maths, no three.js and no React.
 *
 * A timber counter under a cloth awning with two pennants stands in the middle, with bolts of cloth, a scale, a coin stack and a
 * candle on top, and cloth, sacks, a barrel, crates and a pallet on the ground around it, inside a ring of six low stock pieces
 * (cloth stacks and crates, alternating). The ring wears the condition ladder exactly as the other dressings do (it reuses
 * `fountainPlan`): the numbers come from the LandCondition, which comes from the wall tier alone.
 *
 * THE GOODS NEVER GROW. The lists below are fixed. No count or size of cloth, crate, coin or flag depends on the wall tier, the
 * weight, the size class, a gain, a margin of safety or a verdict. There is no gold or silver on this stall (those say
 * "bullion" and "bank"). Condition is shape, lean and rubble, never colour.
 */
import { COLUMN_SLOTS, fountainPlan } from "./fountainDressing";
import type { FountainPlan } from "./fountainDressing";
import type { LandCondition } from "./landCondition";

export const STOCK_SLOTS = COLUMN_SLOTS;
/** The stock ring (world units from the centre), inside the stream band. */
export const STOCK_RING = 2.0;

export type StallPlan = FountainPlan;
export const stallPlan = (c: LandCondition): StallPlan => fountainPlan(c);

/** Which piece stands in ring slot `slot`: cloth stacks and crates alternate, so the ring has gaps. */
export const stockNode = (slot: number): { node: "textiles_stack_large" | "crate_B_big"; scale: number } =>
  slot % 2 ? { node: "crate_B_big", scale: 2 } : { node: "textiles_stack_large", scale: 0.45 };

/** The counter, in the stall's own frame (x along the counter). Code-built timber; the awning is pale cloth. */
export const COUNTER = { halfLength: 0.7, halfDepth: 0.35, height: 0.55 } as const;
/** Poles stand at the counter's ends and hold the awning. */
export const POLE_X = 0.8;
export const POLE_HEIGHT = 1.35;
export const AWNING = { halfLength: 0.95, halfDepth: 0.5, y: 1.35, tilt: 0.18 } as const;
/** The footprint the ground pieces must stay clear of (counter plus poles). */
export const STALL_HALF = { x: POLE_X + 0.05, z: COUNTER.halfDepth } as const;

/** Pennants on the pole tops. Fixed: one blue, one yellow. */
export const PENNANTS: readonly { node: "flag_blue" | "flag_yellow"; x: number }[] = [
  { node: "flag_blue", x: -POLE_X },
  { node: "flag_yellow", x: POLE_X },
];
export const PENNANT_SCALE = 2.5;

/** Goods on the counter, stall frame: x along it. Fixed. */
export const COUNTER_THINGS: readonly { node: string; scale: number; x: number; z: number }[] = [
  { node: "textiles_B", scale: 0.4, x: -0.4, z: 0 },
  { node: "textiles_A", scale: 0.4, x: -0.05, z: 0.05 },
  { node: "scales_lantern", scale: 0.4, x: 0.3, z: -0.05 },
  { node: "coin_stack_small", scale: 0.3, x: 0.55, z: 0.1 },
];

export interface Piece {
  node: string;
  scale: number;
  angle: number;
  r: number;
  reach: number;
  /** Height the piece stands at (a crate on a pallet stands on it). */
  y?: number;
}

/** The fixed goods on the ground. Same for every holding, every rung and the neutral. A test pins it. */
export const PIECES: readonly Piece[] = [
  { node: "textiles_stack_small", scale: 0.4, angle: 1.2, r: 1.2, reach: 0.34 },
  { node: "sack", scale: 3.5, angle: 2.3, r: 1.3, reach: 0.2 },
  { node: "barrel", scale: 2.4, angle: 4.0, r: 1.25, reach: 0.24 },
  { node: "pallet", scale: 0.4, angle: 5.1, r: 1.15, reach: 0.4 },
  { node: "crate_A_small", scale: 2.5, angle: 5.1, r: 1.15, reach: 0.17, y: 0.12 },
  { node: "crate_B_big", scale: 2.2, angle: 0.2, r: 1.3, reach: 0.25 },
];

export const stockAt = (angle: number): { x: number; z: number; rotY: number } => ({
  x: Math.cos(angle) * STOCK_RING,
  z: Math.sin(angle) * STOCK_RING,
  rotY: -angle - Math.PI / 2,
});
